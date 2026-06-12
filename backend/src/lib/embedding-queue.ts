import { logger } from "./logger";
import { redis } from "./redis";

const QUEUE_KEY = "hiai-docs:embedding-queue";

export function enqueueEmbedding(documentId: string): void {
	redis.lpush(QUEUE_KEY, documentId).catch((err) => {
		logger.error({ err, documentId }, "Failed to enqueue embedding job");
	});
}

export { startEmbeddingWorker } from "../embedding/worker";
