import type { PipelineStage } from "./contracts";

export interface ManagedPipelineWorker {
	waitUntilReady?(): Promise<unknown>;
	pause?(doNotWaitActive?: boolean): Promise<void>;
	close(force?: boolean): Promise<void>;
}

export interface ManagedPipelineQueue {
	pause(): Promise<void>;
}

export type PipelineWorkerFactory = () =>
	| ManagedPipelineWorker
	| Promise<ManagedPipelineWorker>;

export interface PipelineRuntime {
	readonly workers: ReadonlyMap<PipelineStage, ManagedPipelineWorker>;
	close(): Promise<void>;
}

export interface StartPipelineWorkersOptions {
	recover(): Promise<void>;
	workerFactories: Partial<Record<PipelineStage, PipelineWorkerFactory>>;
	queues?: Partial<Record<PipelineStage, ManagedPipelineQueue>>;
	closeQueues(): Promise<void>;
	closeConnections?: () => Promise<void>;
	shutdownGraceMs?: number;
	sleep?: (ms: number) => Promise<void>;
}

const STAGE_ORDER: readonly PipelineStage[] = [
	"prepare",
	"embed",
	"graph",
	"summarize",
	"finalize",
];

/**
 * Starts registered stage workers only after PostgreSQL-to-BullMQ recovery.
 * Integration wiring supplies concrete worker factories in the final Task 8
 * step; keeping lifecycle orchestration dependency-injected makes shutdown
 * semantics testable without starting Redis connections at module import.
 */
export async function startPipelineWorkers(
	options: StartPipelineWorkersOptions,
): Promise<PipelineRuntime> {
	await options.recover();

	const workers = new Map<PipelineStage, ManagedPipelineWorker>();
	try {
		for (const stage of STAGE_ORDER) {
			const factory = options.workerFactories[stage];
			if (!factory) continue;
			const worker = await factory();
			workers.set(stage, worker);
			await worker.waitUntilReady?.();
		}
	} catch (error) {
		await Promise.allSettled(
			[...workers.values()].map((worker) => worker.close(true)),
		);
		await options.closeQueues().catch(() => {});
		await options.closeConnections?.().catch(() => {});
		throw error;
	}

	let closePromise: Promise<void> | undefined;
	return {
		workers,
		close() {
			if (closePromise) return closePromise;
			closePromise = closeRuntime(options, workers);
			return closePromise;
		},
	};
}

async function closeRuntime(
	options: StartPipelineWorkersOptions,
	workers: ReadonlyMap<PipelineStage, ManagedPipelineWorker>,
): Promise<void> {
	const graceMs = options.shutdownGraceMs ?? 30_000;
	const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms));

	// Pause producer queues first, then stop workers from claiming more jobs.
	await Promise.allSettled(
		Object.values(options.queues ?? {}).map((queue) => queue.pause()),
	);
	await Promise.allSettled(
		[...workers.values()].map((worker) => worker.pause?.(true)),
	);

	const gracefulClose = Promise.allSettled(
		[...workers.values()].map((worker) => worker.close(false)),
	).then(() => true);
	const drained = await Promise.race([
		gracefulClose,
		sleep(graceMs).then(() => false),
	]);
	if (!drained) {
		await Promise.allSettled(
			[...workers.values()].map((worker) => worker.close(true)),
		);
	}

	await options.closeQueues();
	await options.closeConnections?.();
}
