/**
 * hiai-docs' own MinIO singletons.
 *
 * External consumers should NOT import this module — it pulls in
 * `./config` and crashes the process if any required env var is missing.
 * Use the npm export `@hiai-gg/hiai-docs/backend/lib/minio` instead,
 * which resolves to `./minio-factory.ts` (pure, side-effect-free).
 */
import { config } from "./config";
import { createMinio } from "./minio-factory";

export type { MinioConfig } from "./minio-factory";
export { createMinio, ensureBucket } from "./minio-factory";

// Backwards-compatible optional singletons:
const defaultMinioConfig = {
	endpoint: config.MINIO_ENDPOINT,
	port: config.MINIO_PORT,
	accessKey: config.MINIO_ACCESS_KEY,
	secretKey: config.MINIO_SECRET_KEY,
	useSSL: false,
	region: "us-east-1",
};

const defaultMinioPublicConfig = {
	endpoint: config.MINIO_PUBLIC_ENDPOINT,
	port: config.MINIO_PUBLIC_PORT,
	accessKey: config.MINIO_ACCESS_KEY,
	secretKey: config.MINIO_SECRET_KEY,
	useSSL: false,
	region: "us-east-1",
};

if (!config.MINIO_ENDPOINT) throw new Error("MINIO_ENDPOINT is required");
if (!config.MINIO_PUBLIC_ENDPOINT)
	throw new Error("MINIO_PUBLIC_ENDPOINT is required");

export const minio = createMinio(defaultMinioConfig);
export const minioPublic = createMinio(defaultMinioPublicConfig);

export const BUCKET = config.MINIO_BUCKET;
