import * as schema from "@hiai-docs/db/schema";
import {
	documentPipelineBatches,
	documentPipelineRuns,
} from "@hiai-docs/db/schema";
import { cancelAccountPipelineJobs } from "@hiai-docs/sdk/pipeline-cancellation";
import { Queue } from "bullmq";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createBullMqConnection } from "./connection";
import type { PipelineJob, PipelineStage } from "./contracts";
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from "./names";

const STAGES: readonly PipelineStage[] = [
	"prepare",
	"embed",
	"graph",
	"summarize",
	"finalize",
];

export type AccountPipelineCancellation = Readonly<{
	cancelActorPipeline(
		actorUserId: string,
		signal?: AbortSignal,
	): Promise<{ runs: number; jobs: number }>;
	close(): Promise<void>;
}>;

/**
 * Compose the OSS-owned PostgreSQL cancellation fence and registered BullMQ
 * queues. Hosts provide only the Redis URL; queue handles and SQL never cross
 * the public boundary.
 */
export function createAccountPipelineCancellation(options: {
	redisUrl: string;
	databaseUrl: string;
}): AccountPipelineCancellation {
	const databaseClient = postgres(options.databaseUrl, {
		max: 4,
		idle_timeout: 30,
		connect_timeout: 10,
	});
	const database = drizzle(databaseClient, { schema });
	const queues = STAGES.map(
		(stage) =>
			new Queue<PipelineJob>(QUEUE_NAMES[stage], {
				connection: createBullMqConnection(options.redisUrl),
				defaultJobOptions: DEFAULT_JOB_OPTIONS,
			}),
	);
	const cancellationQueues = queues.map((queue) => ({
		getJobs: (states?: string[]) => queue.getJobs(states as never),
	}));
	let closed = false;
	return {
		async cancelActorPipeline(actorUserId, signal) {
			if (closed) throw new Error("pipeline_cancellation_closed");
			let runs = 0;
			const total = await cancelAccountPipelineJobs(
				actorUserId,
				{
					queues: cancellationQueues,
					async cancelRuns(ownerId) {
						return database.transaction(async (tx) => {
							await tx.execute(
								sql`SELECT set_config('app.current_user_id', ${ownerId}, true)`,
							);
							await tx.execute(
								sql`SELECT set_config('app.current_user_role', 'admin', true)`,
							);
							await tx.execute(
								sql`SELECT set_config('app.current_workspace_id', '', true)`,
							);
							const cancelled = await tx
								.update(documentPipelineRuns)
								.set({
									status: "cancelled",
									prepareStatus: "cancelled",
									embedStatus: "cancelled",
									graphStatus: "cancelled",
									summarizeStatus: "cancelled",
									finalizeStatus: "cancelled",
									errorCode: "account_cancelled",
									completedAt: new Date(),
									updatedAt: new Date(),
								})
								.where(
									and(
										eq(documentPipelineRuns.ownerId, ownerId),
										ne(documentPipelineRuns.status, "cancelled"),
										inArray(documentPipelineRuns.status, [
											"pending",
											"processing",
											"retrying",
										]),
									),
								)
								.returning({ generationId: documentPipelineRuns.generationId });
							if (cancelled.length > 0) {
								await tx
									.update(documentPipelineBatches)
									.set({
										status: "cancelled",
										errorCode: "account_cancelled",
										updatedAt: new Date(),
									})
									.where(
										inArray(
											documentPipelineBatches.generationId,
											cancelled.map((row) => row.generationId),
										),
									);
							}
							runs = cancelled.length;
							return runs;
						});
					},
				},
				signal,
			);
			return { runs, jobs: total - runs };
		},
		async close() {
			if (closed) return;
			closed = true;
			await Promise.all(queues.map((queue) => queue.close()));
			await databaseClient.end();
		},
	};
}
