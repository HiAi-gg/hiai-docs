import { Client } from "minio";
import { config } from "./config";
import { logger } from "./logger";

export const minio = new Client({
	endPoint: config.MINIO_ENDPOINT,
	port: config.MINIO_PORT,
	useSSL: false,
	accessKey: config.MINIO_ACCESS_KEY,
	secretKey: config.MINIO_SECRET_KEY,
	region: "us-east-1",
});

/**
 * Public-facing MinIO client used to sign presigned URLs.
 *
 * MinIO validates the URL signature against the Host header at request time,
 * so a URL signed for the Docker-internal `minio:9000` endpoint is rejected
 * (403) when the browser fetches it via `localhost:9020`. This client signs
 * against the browser-resolvable host/port instead.
 *
 * Note: `region` is required explicitly. Without it, minio-js issues a HEAD
 * request for region auto-detection, which fail with ECONNREFUSED inside the
 * container because the public host/port (localhost:9020) is unreachable.
 */
export const minioPublic = new Client({
	endPoint: config.MINIO_PUBLIC_ENDPOINT,
	port: config.MINIO_PUBLIC_PORT,
	useSSL: false,
	accessKey: config.MINIO_ACCESS_KEY,
	secretKey: config.MINIO_SECRET_KEY,
	region: "us-east-1",
});

export const BUCKET = config.MINIO_BUCKET;

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
