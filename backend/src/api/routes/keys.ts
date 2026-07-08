import { Elysia } from "elysia";
import { z } from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "../../lib/api-keys";
import { recordAuditEvent } from "../../lib/audit";
import { logger } from "../../lib/logger";
import { rateLimitHeaders, writeRateLimiter } from "../middleware/rate-limit";
import { buildTenantContext } from "../middleware/tenant";

const createKeySchema = z.object({
	name: z.string().min(1).max(255),
	scopes: z.array(z.string()).optional(),
	expiresAt: z.string().datetime().optional(),
});

const deleteKeySchema = z.object({});

export const keysRoutes = new Elysia({ prefix: "/api" })
	// POST /api/keys — Create API key
	.post("/keys", async ({ request, set }) => {
		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request.headers.get("x-real-ip") ??
			"unknown";
		const rl = await writeRateLimiter(ip, request);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		const ctx = await buildTenantContext(request);
		if (ctx.role === "none") {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		const userId = ctx.userId;

		const body = createKeySchema.safeParse(await request.json());
		if (!body.success) {
			set.status = 400;
			return { error: "Invalid input", details: body.error.flatten() };
		}

		const { name, scopes, expiresAt } = body.data;
		try {
			const result = await createApiKey(
				userId,
				name,
				scopes,
				expiresAt ? new Date(expiresAt) : undefined,
			);
			set.status = 201;

			const ipAddress =
				request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
				request.headers.get("x-real-ip") ??
				"";
			const userAgent = request.headers.get("user-agent") ?? "";
			recordAuditEvent({
				actorId: userId,
				action: "api-key.create",
				resourceType: "api-key",
				resourceId: result.id,
				details: { name, scopes },
				ipAddress,
				userAgent,
			}).catch(() => {});

			return result;
		} catch (err) {
			logger.error({ err }, "Failed to create API key");
			set.status = 500;
			return { error: "Failed to create API key" };
		}
	})

	// GET /api/keys — List user's API keys
	.get("/keys", async ({ request, set }) => {
		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request.headers.get("x-real-ip") ??
			"unknown";
		const rl = await writeRateLimiter(ip, request);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		const ctx = await buildTenantContext(request);
		if (ctx.role === "none") {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		const userId = ctx.userId;

		try {
			const keys = await listApiKeys(userId);
			return { keys };
		} catch (err) {
			logger.error({ err }, "Failed to list API keys");
			set.status = 500;
			return { error: "Failed to list API keys" };
		}
	})

	// DELETE /api/keys/:id — Revoke API key
	.delete("/keys/:id", async ({ params, request, set }) => {
		const ip =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			request.headers.get("x-real-ip") ??
			"unknown";
		const rl = await writeRateLimiter(ip, request);
		if (!rl.allowed) {
			set.status = 429;
			set.headers = rateLimitHeaders(0, rl.retryAfter);
			return { error: "Too many requests" };
		}
		set.headers = rateLimitHeaders(rl.remaining);

		const ctx = await buildTenantContext(request);
		if (ctx.role === "none") {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		const userId = ctx.userId;

		const parsed = deleteKeySchema.safeParse(params);
		if (!parsed.success) {
			set.status = 400;
			return { error: "Invalid key id" };
		}

		try {
			const deleted = await revokeApiKey(params.id, userId);
			if (!deleted) {
				set.status = 404;
				return { error: "API key not found" };
			}

			const ipAddress =
				request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
				request.headers.get("x-real-ip") ??
				"";
			const userAgent = request.headers.get("user-agent") ?? "";
			recordAuditEvent({
				actorId: userId,
				action: "api-key.revoke",
				resourceType: "api-key",
				resourceId: params.id,
				details: {},
				ipAddress,
				userAgent,
			}).catch(() => {});

			return { success: true };
		} catch (err) {
			logger.error({ err }, "Failed to revoke API key");
			set.status = 500;
			return { error: "Failed to revoke API key" };
		}
	});
