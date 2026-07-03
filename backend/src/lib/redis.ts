/**
 * hiai-docs' own Redis singleton.
 *
 * External consumers should NOT import this module — it pulls in
 * `./config` and crashes the process if any required env var is missing.
 * Use the npm export `@hiai-gg/hiai-docs/backend/lib/redis` instead,
 * which resolves to `./redis-factory.ts` (pure, side-effect-free).
 */
import type Redis from "ioredis";
import { config } from "./config";
import { createRedis } from "./redis-factory";

export type { RedisConfig } from "./redis-factory";
export { createRedis } from "./redis-factory";

// Backwards-compatible singleton (crash at import-time if REDIS_URL is missing — same
// behaviour as before the DI refactor, when the constructor was always called).
export const redis: Redis = (() => {
	if (!config.REDIS_URL) throw new Error("REDIS_URL is required");
	return createRedis({ url: config.REDIS_URL, maxRetriesPerRequest: 3 });
})();
