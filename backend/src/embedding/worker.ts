import { documentEmbeddings, documents } from "@hiai-docs/db/schema";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { redis } from "../lib/redis";
import { embedDocument } from "./index";

const QUEUE_KEY = "hiai-docs:embedding-queue";

export function startEmbeddingWorker(): void {
	logger.info("Embedding worker started");

	const processLoop = async (): Promise<void> => {
		while (true) {
			try {
				const result = await redis.brpop(QUEUE_KEY, 1);
				if (!result) continue;
				const documentId = result[1];
				await processDocument(documentId);
			} catch (err) {
				logger.error({ err }, "Embedding worker error");
			}
		}
	};

	processLoop();
}

async function processDocument(documentId: string): Promise<void> {
	logger.info({ documentId }, "Processing embedding for document");

	try {
		const doc = await db.query.documents.findFirst({
			where: eq(documents.id, documentId),
			columns: {
				id: true,
				title: true,
				content: true,
			},
		});

		if (!doc) {
			logger.warn({ documentId }, "Document not found, skipping embedding");
			return;
		}

		const content = doc.content ?? "";
		if (!content && doc.title === "Untitled") {
			logger.debug(
				{ documentId },
				"Document has no content, skipping embedding",
			);
			return;
		}

		const embeddings = await embedDocument(doc.title, content);

		if (embeddings.length === 0) {
			logger.warn({ documentId }, "No embeddings produced for document");
			return;
		}

		await db.transaction(async (tx) => {
			await tx
				.delete(documentEmbeddings)
				.where(eq(documentEmbeddings.documentId, documentId));

			const rows = embeddings.map((embedding, index) => ({
				documentId,
				chunkIndex: index,
				chunkText: "",
				embedding,
			}));

			await tx.insert(documentEmbeddings).values(rows);
		});

		logger.info(
			{
				documentId,
				chunks: embeddings.length,
				dimensions: embeddings[0]?.length,
			},
			"All chunk embeddings stored for document",
		);
	} catch (err) {
		logger.error({ err, documentId }, "Failed to process document embedding");
	}
}
