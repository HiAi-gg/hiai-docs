import * as schema from "@hiai-docs/db/schema";
import { documents } from "@hiai-docs/db/schema";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import Redis from "ioredis";
import postgres from "postgres";
import {
	type AccountRuntimeCleanup,
	createAccountRuntimeCleanupWithDependencies,
} from "./account-runtime-cleanup-core";

export type { AccountRuntimeCleanup } from "./account-runtime-cleanup-core";

/**
 * Create the server-only OSS runtime cleanup adapter used by account lifecycle
 * hosts. The adapter owns both clients and the complete OSS Redis key taxonomy;
 * hosts provide URLs and never reproduce Redis namespaces or product SQL.
 */
export function createAccountRuntimeCleanup(options: {
	redisUrl: string;
	databaseUrl: string;
}): AccountRuntimeCleanup {
	const databaseClient = postgres(options.databaseUrl, {
		max: 4,
		idle_timeout: 30,
		connect_timeout: 10,
	});
	const database = drizzle(databaseClient, { schema });
	const redis = new Redis(options.redisUrl, {
		maxRetriesPerRequest: 3,
		enableReadyCheck: true,
	});

	return createAccountRuntimeCleanupWithDependencies({
		redis,
		async snapshotActorDocuments(actorUserId, signal) {
			signal?.throwIfAborted();
			const snapshot = await database.transaction(async (tx) => {
				await tx.execute(
					sql`SELECT set_config('app.current_user_id', ${actorUserId}, true)`,
				);
				await tx.execute(
					sql`SELECT set_config('app.current_user_role', 'admin', true)`,
				);
				await tx.execute(
					sql`SELECT set_config('app.current_workspace_id', '', true)`,
				);
				signal?.throwIfAborted();
				return tx
					.select({
						documentId: documents.id,
						workspaceId: documents.workspaceId,
					})
					.from(documents)
					.where(eq(documents.ownerId, actorUserId));
			});
			signal?.throwIfAborted();
			return snapshot;
		},
		closeDatabase: () => databaseClient.end(),
	});
}
