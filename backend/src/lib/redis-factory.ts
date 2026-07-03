/**
 * Pure Redis factory — no module-eval side effects.
 *
 * This module MUST NOT import `./config` (which calls `envSchema.parse` and
 * `process.exit(1)` at import time). External consumers (e.g. docsmint)
 * import this through the npm export `@hiai-gg/hiai-docs/backend/lib/redis`
 * to call `createRedis(cfg)` with their own config; pulling hiai-docs'
 * env-validation into their process would crash it on the first missing
 * variable.
 *
 * The singleton that powers hiai-docs' own runtime lives in `./redis.ts`
 * and imports this factory.
 */
import Redis from "ioredis";
import { logger } from "./logger";

export interface RedisConfig {
	url: string;
	maxRetriesPerRequest: number;
}

export function createRedis(cfg: RedisConfig): Redis {
	const instance = new Redis(cfg.url, {
		maxRetriesPerRequest: cfg.maxRetriesPerRequest,
		retryStrategy(times) {
			const delay = Math.min(times * 200, 2000);
			return delay;
		},
	});

	instance.on("error", (err) => {
		logger.error({ err }, "Redis connection error");
	});

	instance.on("connect", () => {
		logger.info("Redis connected");
	});

	return instance;
}
