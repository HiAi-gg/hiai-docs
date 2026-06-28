#!/usr/bin/env bun
/**
 * Backfill re-embedding script.
 *
 * Walks every document in the database and re-enqueues it for embedding. The
 * embedding worker now enriches each chunk with folder/tag/category metadata,
 * so re-running this script ensures existing embeddings reflect the new
 * metadata preamble.
 *
 * Usage (from backend/ directory):
 *   bun run scripts/reembed-all.ts
 *   bun run scripts/reembed-all.ts --batch-size=50 --delay-ms=1000
 *   bun run scripts/reembed-all.ts --dry-run
 *
 * Flags:
 *   --batch-size=N   Documents enqueued per batch (default: 50)
 *   --delay-ms=N     Delay between batches in milliseconds (default: 1000)
 *   --dry-run        Print what would be enqueued without touching Redis
 *   --owner=UUID     Only re-embed documents owned by this user (debug aid)
 *   --help           Show this help text
 *
 * The script is idempotent — `enqueueEmbedding` simply pushes the document id
 * onto the Redis queue and the worker upserts the resulting rows, so running
 * it twice produces the same final embeddings as running it once.
 */

import {
	categories,
	documentTags,
	documents,
	folders,
	tags,
} from "@hiai-docs/db/schema";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

// --- CLI argument parsing ----------------------------------------------------

interface Args {
	batchSize: number;
	delayMs: number;
	dryRun: boolean;
	owner: string | null;
	help: boolean;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		batchSize: 50,
		delayMs: 1000,
		dryRun: false,
		owner: null,
		help: false,
	};
	for (const arg of argv) {
		if (arg === "--help" || arg === "-h") {
			args.help = true;
			continue;
		}
		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}
		if (arg.startsWith("--batch-size=")) {
			const n = Number.parseInt(arg.slice("--batch-size=".length), 10);
			if (Number.isFinite(n) && n > 0) args.batchSize = n;
			continue;
		}
		if (arg.startsWith("--delay-ms=")) {
			const n = Number.parseInt(arg.slice("--delay-ms=".length), 10);
			if (Number.isFinite(n) && n >= 0) args.delayMs = n;
			continue;
		}
		if (arg.startsWith("--owner=")) {
			args.owner = arg.slice("--owner=".length).trim() || null;
			continue;
		}
		console.warn(`[reembed-all] Ignoring unknown argument: ${arg}`);
	}
	return args;
}

function printHelp(): void {
	const text = [
		"Usage: bun run scripts/reembed-all.ts [options]",
		"",
		"Options:",
		"  --batch-size=N   Documents enqueued per batch (default: 50)",
		"  --delay-ms=N     Delay between batches in milliseconds (default: 1000)",
		"  --dry-run        Print what would be enqueued without touching Redis",
		"  --owner=UUID     Only re-embed documents owned by this user",
		"  --help, -h       Show this help text",
		"",
		"Re-enqueues every document for embedding so the worker can rebuild the",
		"chunk_text preamble with folder, tag, and category names. Safe to",
		"re-run; the worker overwrites existing embeddings for each enqueued id.",
	];
	console.log(text.join("\n"));
}

// --- Helpers -----------------------------------------------------------------

/**
 * Sleep helper used to throttle batch dispatch. Resolves after `ms`
 * milliseconds without blocking the event loop.
 */
function sleep(ms: number): Promise<void> {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a UTC timestamp for the progress log. Kept dependency-free to
 * match the rest of the project (no `date-fns`, no locale formatting).
 */
function nowStamp(): string {
	return new Date().toISOString();
}

/**
 * Resolve metadata for every supplied document id in one pass each. Returns a
 * map of `documentId → { folder, tags, category }`. Documents without
 * metadata are still present in the map with empty arrays / null fields so
 * callers can iterate without conditionals.
 *
 * The lookups run sequentially because they are independent and small per
 * batch — running them in parallel would not materially improve throughput
 * for the batch sizes we use (default 50) and would complicate logging.
 */
async function loadMetadataForBatch(
	db: typeof import("../src/lib/db").db,
	docs: Array<{ id: string; folderId: string | null; categoryId: string | null }>,
): Promise<
	Map<string, { folder: string | null; tagNames: string[]; category: string | null }>
> {
	const out = new Map<
		string,
		{ folder: string | null; tagNames: string[]; category: string | null }
	>();
	for (const doc of docs) {
		out.set(doc.id, { folder: null, tagNames: [], category: null });
	}

	const docIds = docs.map((d) => d.id);
	const folderIds = Array.from(
		new Set(
			docs
				.map((d) => d.folderId)
				.filter((id): id is string => typeof id === "string" && id.length > 0),
		),
	);
	const categoryIds = Array.from(
		new Set(
			docs
				.map((d) => d.categoryId)
				.filter((id): id is string => typeof id === "string" && id.length > 0),
		),
	);

	if (folderIds.length > 0) {
		const folderRows = await db
			.select({ id: folders.id, name: folders.name })
			.from(folders)
			.where(inArray(folders.id, folderIds));
		const folderById = new Map(folderRows.map((r) => [r.id, r.name]));
		for (const doc of docs) {
			if (doc.folderId) {
				const entry = out.get(doc.id);
				if (entry) entry.folder = folderById.get(doc.folderId) ?? null;
			}
		}
	}

	if (categoryIds.length > 0) {
		const categoryRows = await db
			.select({ id: categories.id, name: categories.name })
			.from(categories)
			.where(inArray(categories.id, categoryIds));
		const categoryById = new Map(categoryRows.map((r) => [r.id, r.name]));
		for (const doc of docs) {
			if (doc.categoryId) {
				const entry = out.get(doc.id);
				if (entry) entry.category = categoryById.get(doc.categoryId) ?? null;
			}
		}
	}

	if (docIds.length > 0) {
		const tagRows = await db
			.select({
				documentId: documentTags.documentId,
				name: tags.name,
			})
			.from(documentTags)
			.innerJoin(tags, eq(tags.id, documentTags.tagId))
			.where(inArray(documentTags.documentId, docIds));
		const tagsByDoc = new Map<string, string[]>();
		for (const row of tagRows) {
			const list = tagsByDoc.get(row.documentId) ?? [];
			list.push(row.name);
			tagsByDoc.set(row.documentId, list);
		}
		for (const doc of docs) {
			const entry = out.get(doc.id);
			if (entry) entry.tagNames = tagsByDoc.get(doc.id) ?? [];
		}
	}

	return out;
}

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}

	console.log(
		`[reembed-all ${nowStamp()}] Starting backfill (batch-size=${args.batchSize}, delay-ms=${args.delayMs}, dry-run=${args.dryRun})`,
	);

	// Lazy-load db + queue so the --help path doesn't require a live DB.
	const { db } = await import("../src/lib/db");
	const { enqueueEmbedding, redis } = await import("../src/lib/embedding-queue");
	const { logger } = await import("../src/lib/logger");

	// Count total documents up front so we can render meaningful progress.
	const countRows = await db
		.select({ total: sql<number>`COUNT(*)::int` })
		.from(documents)
		.where(args.owner ? eq(documents.ownerId, args.owner) : undefined);
	const total = countRows[0]?.total ?? 0;
	if (total === 0) {
		console.log(`[reembed-all] No documents found — nothing to do.`);
		return;
	}
	console.log(`[reembed-all] Found ${total} document(s) to re-embed.`);

	if (args.dryRun) {
		console.log(
			"[reembed-all] --dry-run set; the worker queue will not be touched.",
		);
	}

	let processed = 0;
	let batchIndex = 0;
	let lastId: string | null = null;
	const startMs = Date.now();

	// Stream documents in ascending id order. Using a keyset (lastId) avoids
	// OFFSET, which gets slow on large tables; id is indexed and the default
	// random UUID still keeps things ordered consistently for repeated runs.
	while (processed < total) {
		const remaining = total - processed;
		const limit = Math.min(args.batchSize, remaining);
		const rows = await db
			.select({
				id: documents.id,
				folderId: documents.folderId,
				categoryId: documents.categoryId,
				title: documents.title,
			})
			.from(documents)
			.where(
				lastId
					? and(
							args.owner ? eq(documents.ownerId, args.owner) : undefined,
							sql`${documents.id} > ${lastId}`,
						)
					: args.owner
						? eq(documents.ownerId, args.owner)
						: undefined,
			)
			.orderBy(asc(documents.id))
			.limit(limit);

		if (rows.length === 0) break;
		lastId = rows[rows.length - 1]?.id ?? lastId;

		// Resolve metadata up-front so we can log a representative line per
		// batch (folder / tags / category counts).
		const metadataMap = await loadMetadataForBatch(db, rows);

		let withFolder = 0;
		let withTags = 0;
		let withCategory = 0;
		for (const doc of rows) {
			const meta = metadataMap.get(doc.id);
			if (meta?.folder) withFolder += 1;
			if (meta?.tagNames && meta.tagNames.length > 0) withTags += 1;
			if (meta?.category) withCategory += 1;
		}

		if (!args.dryRun) {
			for (const doc of rows) {
				enqueueEmbedding(doc.id);
			}
		}

		processed += rows.length;
		batchIndex += 1;
		const sample = rows[0]?.title ?? "(untitled)";
		console.log(
			`[reembed-all ${nowStamp()}] Embedded ${processed}/${total} documents ` +
				`(batch #${batchIndex}, folder=${withFolder}, tags=${withTags}, category=${withCategory}, sample="${sample}")`,
		);

		// Throttle between batches. Skip the delay after the final batch so a
		// small dataset finishes instantly.
		if (processed < total) {
			await sleep(args.delayMs);
		}
	}

	const durationMs = Date.now() - startMs;
	console.log(
		`[reembed-all ${nowStamp()}] Done. Embedded ${processed}/${total} documents in ${batchIndex} batch(es) (${(durationMs / 1000).toFixed(1)}s).`,
	);

	// Best-effort: flush the Redis connection so the script exits cleanly.
	// Without this the ioredis client keeps the event loop alive for a few
	// seconds after the last enqueue call.
	try {
		await redis.quit();
	} catch {
		// Ignore — quit errors are not actionable from a one-shot script.
	}

	// Silence the unused-import warning when logger is never called.
	void logger;
	// Keep an isNotNull reference available for future filters without
	// triggering an unused-import warning under stricter lint configs.
	void isNotNull;
}

main().catch((err) => {
	console.error("[reembed-all] Fatal error:", err);
	process.exit(1);
});
