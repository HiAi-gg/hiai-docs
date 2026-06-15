import { attachments, documents } from "@hiai-docs/db/schema";
import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { getSessionUserId } from "../../lib/auth-helpers";
import { db } from "../../lib/db";
import { logger } from "../../lib/logger";
import { BUCKET, minio } from "../../lib/minio";
import { rateLimitHeaders, writeRateLimiter } from "../middleware/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function getClientIp(request: Request): Promise<string> {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		request.headers.get("x-real-ip") ??
		"unknown"
	);
}

/**
 * Convert an internal MinIO presigned URL into a URL the browser can fetch.
 *
 * In Docker dev, the MinIO client is configured with the Docker-internal
 * endpoint `minio:9000`, so the URLs it generates are not resolvable from
 * the host browser. Rewrite the authority to `localhost:9020` (the host
 * port mapped via docker-compose) so the browser can reach the same
 * presigned object via the published port.
 */
function makePublicUrl(presignedUrl: string): string {
	try {
		const parsed = new URL(presignedUrl);
		if (parsed.hostname === "minio" && parsed.port === "9000") {
			parsed.hostname = "localhost";
			parsed.port = "9020";
		}
		return parsed.toString();
	} catch {
		return presignedUrl;
	}
}

export const attachmentRoutes = new Elysia({ prefix: "/api" })

	// POST /api/documents/:id/attachments — Upload image attachment
	.post("/documents/:id/attachments", async ({ params, request, set }) => {
		const ip = await getClientIp(request);
		const rl = await writeRateLimiter(ip);
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

		const documentId = params.id;

		// Verify document exists and user owns it
		const doc = await db
			.select({ id: documents.id })
			.from(documents)
			.where(and(eq(documents.id, documentId), eq(documents.ownerId, userId)))
			.limit(1);

		if (!doc.length) {
			set.status = 404;
			return { error: "Document not found" };
		}

		// Parse multipart form data
		let file: File | null;
		try {
			const formData = await request.formData();
			file = formData.get("file") as File | null;
		} catch {
			set.status = 400;
			return { error: "Failed to parse form data" };
		}

		if (!file) {
			set.status = 400;
			return { error: "No file provided" };
		}

		if (!file.type.startsWith("image/")) {
			set.status = 415;
			return { error: "Only image files are allowed" };
		}

		if (file.size > MAX_FILE_SIZE) {
			set.status = 413;
			return {
				error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
			};
		}

		// Generate MinIO key
		const ext = file.name.split(".").pop() ?? "bin";
		const key = `${userId}/${documentId}/${nanoid()}.${ext}`;

		try {
			// Upload to MinIO
			const arrayBuffer = await file.arrayBuffer();
			await minio.putObject(BUCKET, key, Buffer.from(arrayBuffer), file.size, {
				"Content-Type": file.type,
			});

			// Insert attachment row
			const [created] = await db
				.insert(attachments)
				.values({
					documentId,
					filename: file.name,
					mimeType: file.type,
					size: file.size,
					minioKey: key,
				})
				.returning();

			if (!created) {
				set.status = 500;
				return { error: "Failed to save attachment record" };
			}

			// Generate presigned GET URL (24h expiry)
			const presignedUrl = await minio.presignedGetObject(
				BUCKET,
				key,
				24 * 60 * 60,
			);

			set.status = 201;
			return {
				id: created.id,
				filename: created.filename,
				mimeType: created.mimeType,
				size: created.size,
				url: makePublicUrl(presignedUrl),
			};
		} catch (err) {
			logger.error({ err }, "Failed to upload attachment");
			set.status = 500;
			return { error: "Failed to upload attachment" };
		}
	})

	// GET /api/documents/:id/attachments — List attachments for a document
	.get("/documents/:id/attachments", async ({ params, set, request }) => {
		const userId = await getSessionUserId(request.headers);
		if (!userId) {
			set.status = 401;
			return { error: "Unauthorized" };
		}

		const documentId = params.id;

		// Verify document exists and user owns it
		const doc = await db
			.select({ id: documents.id })
			.from(documents)
			.where(and(eq(documents.id, documentId), eq(documents.ownerId, userId)))
			.limit(1);

		if (!doc.length) {
			set.status = 404;
			return { error: "Document not found" };
		}

		try {
			const rows = await db
				.select()
				.from(attachments)
				.where(eq(attachments.documentId, documentId));

			// Generate presigned URLs for each attachment
			const result = await Promise.all(
				rows.map(async (row) => {
					const presignedUrl = await minio.presignedGetObject(
						BUCKET,
						row.minioKey,
						24 * 60 * 60,
					);
					return {
						id: row.id,
						filename: row.filename,
						mimeType: row.mimeType,
						size: row.size,
						url: makePublicUrl(presignedUrl),
					};
				}),
			);

			return { items: result };
		} catch (err) {
			logger.error({ err }, "Failed to list attachments");
			set.status = 500;
			return { error: "Failed to list attachments" };
		}
	});
