/**
 * hiai-docs' own S3 (SeaweedFS) singletons.
 *
 * External consumers should NOT import this module — it pulls in
 * `./config` and crashes the process if any required env var is missing.
 * Use the npm export `@hiai-gg/docsmint/backend/lib/storage` instead,
 * which resolves to `./storage-factory.ts` (pure, side-effect-free).
 */
import { config } from "./config";
import { createObjectStorageClient } from "./storage-factory";

export type { ObjectStorageConfig } from "./storage-factory";
export { createObjectStorageClient, ensureBucket } from "./storage-factory";

function endpointConfig(url: string, fallbackPort: number) {
	const parsed = new URL(url);
	if (parsed.username || parsed.password) {
		throw new Error("Storage endpoint URLs must not contain credentials");
	}
	return {
		endpoint: parsed.hostname,
		port: parsed.port ? Number(parsed.port) : fallbackPort,
		useSSL: parsed.protocol === "https:",
	};
}

const internalEndpoint = endpointConfig(
	config.STORAGE_INTERNAL_ENDPOINT_URL ??
		`http://${config.STORAGE_ENDPOINT}:${config.STORAGE_PORT}`,
	config.STORAGE_PORT,
);
const publicEndpoint = endpointConfig(
	config.STORAGE_PUBLIC_ENDPOINT_URL ??
		`http://${config.STORAGE_PUBLIC_ENDPOINT}:${config.STORAGE_PUBLIC_PORT}`,
	config.STORAGE_PUBLIC_PORT,
);

const internalConfig = {
	...internalEndpoint,
	accessKey: config.STORAGE_ACCESS_KEY,
	secretKey: config.STORAGE_SECRET_KEY,
	region: config.STORAGE_REGION,
	forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
};

const publicConfig = {
	...publicEndpoint,
	accessKey: config.STORAGE_ACCESS_KEY,
	secretKey: config.STORAGE_SECRET_KEY,
	region: config.STORAGE_REGION,
	forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
};

if (!config.STORAGE_ENDPOINT) throw new Error("STORAGE_ENDPOINT is required");
if (!config.STORAGE_PUBLIC_ENDPOINT)
	throw new Error("STORAGE_PUBLIC_ENDPOINT is required");

export const storage = createObjectStorageClient(internalConfig);
export const storagePublic = createObjectStorageClient(publicConfig);
export const BUCKET = config.STORAGE_BUCKET;
