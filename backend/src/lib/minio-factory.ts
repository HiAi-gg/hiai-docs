/**
 * Pure MinIO factory — no module-eval side effects.
 *
 * This module MUST NOT import `./config` (which calls `envSchema.parse` and
 * `process.exit(1)` at import time). External consumers (e.g. docsmint)
 * import this through the npm export `@hiai-gg/hiai-docs/backend/lib/minio`
 * to call `createMinio(cfg)` with their own config; pulling hiai-docs'
 * env-validation into their process would crash it on the first missing
 * variable.
 *
 * The singletons that power hiai-docs' own runtime live in `./minio.ts`
 * and import this factory.
 */
import { Client } from "minio";
import { logger } from "./logger";

export interface MinioConfig {
	endpoint: string;
	port: number;
	accessKey: string;
	secretKey: string;
	useSSL: boolean;
	region: string;
}

export function createMinio(cfg: MinioConfig): Client {
	return new Client({
		endPoint: cfg.endpoint,
		port: cfg.port,
		useSSL: cfg.useSSL,
		accessKey: cfg.accessKey,
		secretKey: cfg.secretKey,
		region: cfg.region,
	});
}

export async function ensureBucket(
	client: Client,
	bucket: string,
): Promise<void> {
	const exists = await client.bucketExists(bucket);
	if (!exists) {
		await client.makeBucket(bucket, "us-east-1");
		logger.info({ bucket }, "Created MinIO bucket");
	}
}
