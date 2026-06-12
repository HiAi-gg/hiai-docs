import { attachments } from "@hiai-docs/db/schema";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../../lib/db";
import { logger } from "../../lib/logger";
import { verifyWebhookSignature } from "../middleware/webhook-verify";

export const webhookRoutes = new Elysia({ prefix: "/api/webhooks" }).post(
	"/minio",
	async ({ request, body }) => {
		const rawBody = await request.text();
		const sig = request.headers.get("x-minio-signature");

		if (!verifyWebhookSignature(rawBody, sig)) {
			logger.warn("Invalid MinIO webhook signature");
			return { error: "Invalid signature" };
		}

		const event = body as Record<string, unknown>;
		const records = (event.Records ?? []) as Array<Record<string, unknown>>;

		for (const record of records) {
			const eventName = record.eventName as string;
			const s3 = record.s3 as Record<string, unknown> | undefined;
			const key = (s3?.object as Record<string, unknown>)?.key as string;

			if (!key) continue;

			logger.info({ eventName, key }, "MinIO webhook event");

			if (eventName === "s3:ObjectRemoved:Delete") {
				await db
					.delete(attachments)
					.where(eq(attachments.minioKey, key))
					.catch((err: unknown) =>
						logger.error({ err, key }, "Failed to mark attachment deleted"),
					);
			}
		}

		return { received: true };
	},
);
