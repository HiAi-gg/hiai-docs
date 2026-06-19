import { documentTags, tags as tagsTable } from "@hiai-docs/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { getEmbedding } from "../../embedding";
import { getSessionUserId } from "../../lib/auth-helpers";
import { db } from "../../lib/db";
import { logger } from "../../lib/logger";
import { rateLimitHeaders, searchRateLimiter } from "../middleware/rate-limit";

const searchQuerySchema = z.object({
	q: z.string().optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	sort: z
		.enum(["relevance", "date_desc", "date_asc", "name_asc", "name_desc"])
		.default("relevance"),
	folder: z.string().optional(),
	tags: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
});

const suggestQuerySchema = z.object({
	q: z.string().optional(),
});

/**
 * Hybrid search: combines full-text (tsvector) + semantic (pgvector cosine).
 * Results are merged and deduplicated with weighted scoring.
 */
export const searchRoutes = new Elysia({ prefix: "/api/search" })
	.get("/", async ({ query, set, request }) => {
		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request.headers.get("x-real-ip") ??
			"unknown";
		const rl = await searchRateLimiter(ip);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		const userId = await getSessionUserId(request.headers);
		if (!userId) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		const parsed = searchQuerySchema.safeParse(query);
		if (!parsed.success) {
			set.status = 400;
			return { error: "Invalid query", details: parsed.error.flatten() };
		}
		try {
			const {
				q: rawQ,
				page,
				limit,
				sort,
				folder,
				tags,
				dateFrom,
				dateTo,
			} = parsed.data;
			const q = rawQ ?? "";
			const offset = (page - 1) * limit;

			if (!q.trim()) return { items: [], total: 0, page, limit };

			// Run full-text and semantic search in parallel
			const [textResults, semanticResults] = await Promise.all([
				fullTextSearch(userId, q, limit * 2),
				semanticSearch(userId, q, limit * 2),
			]);

			// Merge results with weighted scoring (0.4 text + 0.6 semantic)
			type RawSearchResult = {
				id: string;
				title: string;
				snippet: string;
				score: number;
				folder_id: string | null;
				folder_name: string | null;
				created_at: string;
				updated_at: string;
			};
			type SearchResult = {
				id: string;
				title: string;
				snippet: string;
				score: number;
				folder_id: string | null;
				folder_name: string | null;
				created_at: string;
				updated_at: string;
				tags?: Array<{ id: string; name: string; color: string | null }>;
			};
			const merged = new Map<string, SearchResult>();

			function mapResult(row: RawSearchResult): SearchResult {
				return {
					id: row.id,
					title: row.title,
					snippet: row.snippet,
					score: row.score,
					folder_id: row.folder_id,
					folder_name: row.folder_name,
					created_at: row.created_at,
					updated_at: row.updated_at,
				};
			}

			for (const row of textResults as unknown as RawSearchResult[]) {
				const mapped = mapResult(row);
				mapped.score = row.score * 0.4;
				merged.set(row.id, mapped);
			}

			for (const row of semanticResults as unknown as RawSearchResult[]) {
				const existing = merged.get(row.id);
				if (existing) {
					existing.score += row.score * 0.6;
				} else {
					const mapped = mapResult(row);
					mapped.score = row.score * 0.6;
					merged.set(row.id, mapped);
				}
			}

			// Apply filters (folder, date range, tags) before sort + pagination
			let filtered = Array.from(merged.values());

			if (folder) {
				filtered = filtered.filter((r) => r.folder_id === folder);
			}

			if (dateFrom) {
				const from = new Date(dateFrom);
				if (!Number.isNaN(from.getTime())) {
					filtered = filtered.filter((r) => new Date(r.created_at) >= from);
				}
			}

			if (dateTo) {
				const to = new Date(dateTo);
				if (!Number.isNaN(to.getTime())) {
					// Include the entire "to" day
					to.setHours(23, 59, 59, 999);
					filtered = filtered.filter((r) => new Date(r.created_at) <= to);
				}
			}

			if (tags) {
				const tagList = tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean);
				if (tagList.length > 0) {
					const allowedIds = await tagFilter(userId, tagList);
					filtered = filtered.filter((r) => allowedIds.has(r.id));
				}
			}

			// Sort by selected order, then paginate
			switch (sort) {
				case "date_desc":
					filtered.sort(
						(a, b) =>
							new Date(b.created_at).getTime() -
							new Date(a.created_at).getTime(),
					);
					break;
				case "date_asc":
					filtered.sort(
						(a, b) =>
							new Date(a.created_at).getTime() -
							new Date(b.created_at).getTime(),
					);
					break;
				case "name_asc":
					filtered.sort((a, b) => a.title.localeCompare(b.title));
					break;
				case "name_desc":
					filtered.sort((a, b) => b.title.localeCompare(a.title));
					break;
				default:
					filtered.sort((a, b) => b.score - a.score);
					break;
			}
			const total = filtered.length;
			const items = filtered.slice(offset, offset + limit);

			const itemsWithTags = await withTags(items);
			return { items: itemsWithTags, total, page, limit };
		} catch (err) {
			logger.error({ err }, "Search failed");
			set.status = 500;
			return { error: "Search failed" };
		}
	})
	.get("/suggest", async ({ query, set, request }) => {
		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request.headers.get("x-real-ip") ??
			"unknown";
		const rl = await searchRateLimiter(ip);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		const userId = await getSessionUserId(request.headers);
		if (!userId) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		const parsed = suggestQuerySchema.safeParse(query);
		if (!parsed.success) {
			set.status = 400;
			return { error: "Invalid query", details: parsed.error.flatten() };
		}
		try {
			const q = parsed.data.q ?? "";
			if (!q.trim()) return [];
			const results = await db.execute(sql`
        SELECT id, title, similarity(title, ${q}) as score
        FROM documents
        WHERE owner_id = ${userId} AND title % ${q}
        ORDER BY score DESC LIMIT 5
      `);
			return results;
		} catch (err) {
			logger.error({ err }, "Suggest failed");
			set.status = 500;
			return { error: "Suggest failed" };
		}
	});

/**
 * Full-text search using PostgreSQL tsvector + ts_rank.
 */
async function fullTextSearch(userId: string, q: string, limit: number) {
	const tsQuery = sql`plainto_tsquery('english', ${q})`;

	return db.execute(sql`
    SELECT d.id, d.title, LEFT(d.content, 200) as snippet,
      ts_rank(d.search_vector, ${tsQuery}) as score,
      d.folder_id, f.name as folder_name, d.created_at, d.updated_at
    FROM documents d
    LEFT JOIN folders f ON f.id = d.folder_id
    WHERE d.owner_id = ${userId}
      AND d.search_vector @@ ${tsQuery}
    ORDER BY score DESC
    LIMIT ${limit}
  `);
}

/**
 * Semantic search using pgvector cosine similarity.
 * Queries the document_embeddings table against the query embedding.
 */
async function semanticSearch(userId: string, q: string, limit: number) {
	try {
		const queryEmbedding = await getEmbedding(q);

		// Skip if embedding is all zeros (provider failure)
		if (queryEmbedding.every((v) => v === 0)) {
			return [];
		}

		const embeddingStr = `[${queryEmbedding.join(",")}]`;

		return db.execute(sql`
      SELECT DISTINCT ON (d.id)
        d.id, d.title, LEFT(d.content, 200) as snippet,
        1 - (de.embedding <=> ${embeddingStr}::vector) as score,
        d.folder_id, f.name as folder_name, d.created_at, d.updated_at
      FROM document_embeddings de
      JOIN documents d ON d.id = de.document_id
      LEFT JOIN folders f ON f.id = d.folder_id
      WHERE d.owner_id = ${userId}
        AND de.embedding IS NOT NULL
      ORDER BY d.id, de.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);
	} catch (err) {
		logger.warn({ err }, "Semantic search failed, falling back to text-only");
		return [];
	}
}

/**
 * Return the set of document ids owned by `userId` that have at least one of
 * the supplied tag names (ANY semantics — a doc qualifies if it carries any
 * of the requested tags).
 */
async function tagFilter(
	userId: string,
	tagNames: string[],
): Promise<Set<string>> {
	if (tagNames.length === 0) return new Set();

	// Look up tag ids by name (parameterised — safe against injection).
	const tagRows = await db
		.select({ id: tagsTable.id })
		.from(tagsTable)
		.where(
			and(eq(tagsTable.ownerId, userId), inArray(tagsTable.name, tagNames)),
		);
	if (tagRows.length === 0) return new Set();

	const tagIds = tagRows.map((r) => r.id);

	const docRows = await db
		.selectDistinct({ documentId: documentTags.documentId })
		.from(documentTags)
		.where(inArray(documentTags.tagId, tagIds));

	return new Set(docRows.map((r) => r.documentId));
}

async function withTags<T extends { id: string }>(
	rows: T[],
): Promise<
	Array<T & { tags: Array<{ id: string; name: string; color: string | null }> }>
> {
	if (rows.length === 0) return [];
	const ids = rows.map((r) => r.id);
	const tagRows = await db
		.select({
			documentId: documentTags.documentId,
			id: tagsTable.id,
			name: tagsTable.name,
			color: tagsTable.color,
		})
		.from(documentTags)
		.innerJoin(tagsTable, eq(tagsTable.id, documentTags.tagId))
		.where(inArray(documentTags.documentId, ids));

	const byDoc = new Map<
		string,
		Array<{ id: string; name: string; color: string | null }>
	>();
	for (const t of tagRows) {
		const list = byDoc.get(t.documentId) ?? [];
		list.push({ id: t.id, name: t.name, color: t.color });
		byDoc.set(t.documentId, list);
	}
	return rows.map((r) => ({ ...r, tags: byDoc.get(r.id) ?? [] }));
}
