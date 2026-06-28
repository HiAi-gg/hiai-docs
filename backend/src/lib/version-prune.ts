import { versions } from "@hiai-docs/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { logger } from "./logger";
import { redis } from "./redis";

const PRUNE_DEBOUNCE_KEY = (docId: string) => `hiai-docs:prune:${docId}`;
const PRUNE_DEBOUNCE_SECONDS = 60;

/**
 * Garbage-collect auto-saved versions for a single document, keeping the
 * newest `VERSION_RETENTION_COUNT` (default 50) auto-saved rows and
 * leaving snapshots (`is_snapshot = true`) untouched. Snapshots are
 * user-named, intentionally durable, and excluded from the count.
 *
 * Debounced via Redis NX-EX so we don't re-run this for the same doc
 * within a 60-second window — PATCH can fire many times in a row when
 * the editor auto-saves, and pruning is a write-heavy operation that
 * does not need to run on every keystroke.
 *
 * Errors are logged and swallowed; pruning is a background best-effort
 * task and must never propagate to the user-facing PATCH response.
 */
export async function maybePruneVersions(documentId: string): Promise<void> {
	// Debounce: skip when another prune for this doc is still cooling down.
	const key = PRUNE_DEBOUNCE_KEY(documentId);
	const acquired = await redis.set(
		key,
		"1",
		"EX",
		PRUNE_DEBOUNCE_SECONDS,
		"NX",
	);
	if (!acquired) return;

	try {
		const retention = config.VERSION_RETENTION_COUNT ?? 50;

		// Count auto-saved versions only (isSnapshot = false). Snapshots
		// are never pruned, so they should not count against retention.
		const countRows = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(versions)
			.where(
				and(
					eq(versions.documentId, documentId),
					eq(versions.isSnapshot, false),
				),
			);
		const count = countRows[0]?.count ?? 0;
		if (count <= retention) return;

		const toDelete = count - retention;
		// Oldest auto-saved versions get pruned first; `id` is a tiebreaker
		// for rows with identical `createdAt` so the delete is deterministic.
		const staleVersions = await db
			.select({ id: versions.id })
			.from(versions)
			.where(
				and(
					eq(versions.documentId, documentId),
					eq(versions.isSnapshot, false),
				),
			)
			.orderBy(asc(versions.createdAt), asc(versions.id))
			.limit(toDelete);

		if (staleVersions.length > 0) {
			const ids = staleVersions.map((v) => v.id);
			await db.delete(versions).where(inArray(versions.id, ids));
			logger.info(
				{ documentId, pruned: ids.length, retention },
				"Pruned old auto-saved versions",
			);
		}
	} catch (err) {
		logger.error({ err, documentId }, "Version pruning failed");
	}
}
