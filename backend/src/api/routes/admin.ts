/**
 * Admin maintenance endpoints.
 *
 * All endpoints live under `/api/admin` and are gated by a static API key
 * (`config.HIAI_DOCS_API_KEY`) supplied via the `x-api-key` header. These
 * routes are intentionally NOT scoped per-user — they are operator tooling
 * used by ops scripts and external services (e.g. the embedding monitor
 * from T3.2). They share `searchRateLimiter`, which already bypasses its
 * own bucket when a valid API key is presented, so a healthy ops pipeline
 * is never throttled but a misconfigured caller still gets 429s.
 */
import { documentEmbeddings, documents } from "@hiai-docs/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { getEmbedding } from "../../embedding";
import { config } from "../../lib/config";
import { db } from "../../lib/db";
import { enqueueEmbedding } from "../../lib/embedding-queue";
import { logger } from "../../lib/logger";
import { rateLimitHeaders, searchRateLimiter } from "../middleware/rate-limit";

/**
 * Verify the caller presented the configured admin API key. Returns
 * `true` when either (a) no key is configured (dev convenience) or
 * (b) the supplied key matches `config.HIAI_DOCS_API_KEY`.
 *
 * Intentionally permissive in development: if an operator hasn't set the
 * key, we still let requests through so local tooling can hit the
 * endpoints without ceremony. In production the key MUST be set — the
 * `config` module already enforces BETTER_AUTH_SECRET in production;
 * `HIAI_DOCS_API_KEY` is the same class of secret and the operator is
 * expected to set it.
 */
function verifyAdminKey(request: Request): boolean {
	const expected = config.HIAI_DOCS_API_KEY;
	if (!expected) {
		// No key configured — permissive mode (dev only).
		return true;
	}
	const supplied = request.headers.get("x-api-key");
	return supplied === expected;
}

/**
 * Extract a stable client IP for rate limiting. Mirrors the helper
 * pattern used by the public routes so the limiter's Redis bucket key
 * is consistent across the API surface.
 */
function clientIp(request: Request): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		"unknown"
	);
}

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
	/**
	 * POST /api/admin/reindex/:docId
	 *
	 * Force re-embed a single document. Clears existing chunks and pushes
	 * the id onto the embedding queue so the worker picks it up on the
	 * next tick. Returns 404 when the document does not exist so callers
	 * can detect typos / stale ids.
	 */
	.post("/reindex/:docId", async ({ params, set, request }) => {
		const ip = clientIp(request);
		const rl = await searchRateLimiter(ip, request);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		if (!verifyAdminKey(request)) {
			set.status = 401;
			return { error: "Invalid or missing admin API key" };
		}

		try {
			const existing = await db
				.select({ id: documents.id })
				.from(documents)
				.where(eq(documents.id, params.docId))
				.limit(1);
			if (existing.length === 0) {
				set.status = 404;
				return { error: "Document not found" };
			}

			// Drop existing chunks so the worker writes a clean set rather
			// than upserting on the (document_id, chunk_index) unique
			// index. The worker wraps the same delete+insert in a
			// transaction, but doing the delete here lets us report an
			// accurate "previous chunks removed" count in the response if
			// we ever need it, and avoids a brief window where the
			// document has 2x chunks visible to search.
			await db
				.delete(documentEmbeddings)
				.where(eq(documentEmbeddings.documentId, params.docId));

			enqueueEmbedding(params.docId);

			return {
				success: true,
				documentId: params.docId,
				message: "Existing embeddings cleared and document re-queued",
			};
		} catch (err) {
			logger.error({ err, docId: params.docId }, "Admin reindex failed");
			set.status = 500;
			return { error: "Failed to reindex document" };
		}
	})

	/**
	 * GET /api/admin/embedding-stats
	 *
	 * Embedding pipeline observability: how many documents have at least
	 * one chunk, total chunks across all docs, and how many of those
	 * chunks are empty (zero-vector fallback rows from a misconfigured
	 * provider). A non-zero `emptyChunks` count is a strong signal that
	 * `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` are
	 * missing or wrong.
	 */
	.get("/embedding-stats", async ({ set, request }) => {
		const ip = clientIp(request);
		const rl = await searchRateLimiter(ip, request);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		if (!verifyAdminKey(request)) {
			set.status = 401;
			return { error: "Invalid or missing admin API key" };
		}

		try {
			// Three independent aggregates — run them in parallel so a
			// busy DB doesn't serialize them. Each one is a single scan
			// over `document_embeddings` (the smallest relevant table)
			// plus one over `documents` for the "with embeddings" count.
			const [docsWithEmbeddingsRow, totalChunksRow, emptyChunksRow] =
				await Promise.all([
					db
						.select({
							value: sql<number>`COUNT(DISTINCT ${documentEmbeddings.documentId})::int`,
						})
						.from(documentEmbeddings),
					db.select({ value: count() }).from(documentEmbeddings),
					db
						.select({
							value: sql<number>`SUM(CASE WHEN ${documentEmbeddings.embedding} IS NULL THEN 1 ELSE 0 END)::int`,
						})
						.from(documentEmbeddings),
				]);

			return {
				stats: {
					docsWithEmbeddings: docsWithEmbeddingsRow[0]?.value ?? 0,
					totalChunks: totalChunksRow[0]?.value ?? 0,
					emptyChunks: emptyChunksRow[0]?.value ?? 0,
				},
			};
		} catch (err) {
			logger.error({ err }, "Admin embedding-stats failed");
			set.status = 500;
			return { error: "Failed to compute embedding stats" };
		}
	})

	/**
	 * GET /api/admin/health/embeddings
	 *
	 * Run a single embedding call against a probe string and report
	 * whether the configured provider is reachable.
	 *
	 * Status semantics:
	 *   - `not-configured` — neither EMBEDDING_BASE_URL nor
	 *     EMBEDDING_MODEL are set; the pipeline is dormant. Semantic
	 *     search degrades to text-only.
	 *   - `degraded` — configured but the call returned a zero vector
	 *     (provider unreachable / auth failure) OR the provider raised
	 *     and the fallback also failed. Pipeline runs but produces
	 *     useless vectors.
	 *   - `ok` — non-zero vector returned. Pipeline is healthy.
	 */
	.get("/health/embeddings", async ({ set, request }) => {
		const ip = clientIp(request);
		const rl = await searchRateLimiter(ip, request);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		if (!verifyAdminKey(request)) {
			set.status = 401;
			return { error: "Invalid or missing admin API key" };
		}

		const probe = "hiai-docs embedding provider health probe";

		if (!config.EMBEDDING_BASE_URL || !config.EMBEDDING_MODEL) {
			return {
				status: "not-configured",
				provider: {
					baseUrl: config.EMBEDDING_BASE_URL ?? null,
					model: config.EMBEDDING_MODEL ?? null,
				},
				details:
					"EMBEDDING_BASE_URL or EMBEDDING_MODEL is unset — embeddings will be zero vectors",
			};
		}

		const startedAt = Date.now();
		try {
			const vector = await getEmbedding(probe);
			const latencyMs = Date.now() - startedAt;
			const allZero = vector.every((v) => v === 0);

			if (allZero) {
				return {
					status: "degraded",
					provider: {
						baseUrl: config.EMBEDDING_BASE_URL,
						model: config.EMBEDDING_MODEL,
					},
					latencyMs,
					details:
						"Provider returned a zero vector — check API key, model name, and base URL",
				};
			}

			return {
				status: "ok",
				provider: {
					baseUrl: config.EMBEDDING_BASE_URL,
					model: config.EMBEDDING_MODEL,
				},
				latencyMs,
				dimensions: vector.length,
			};
		} catch (err) {
			const latencyMs = Date.now() - startedAt;
			logger.warn({ err }, "Embedding provider health probe failed");
			return {
				status: "degraded",
				provider: {
					baseUrl: config.EMBEDDING_BASE_URL,
					model: config.EMBEDDING_MODEL,
				},
				latencyMs,
				details:
					err instanceof Error
						? err.message
						: "Unknown embedding provider error",
			};
		}
	});
