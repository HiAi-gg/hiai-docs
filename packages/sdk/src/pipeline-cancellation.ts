export type CancellablePipelineJob = Readonly<{
	data?: Readonly<{ ownerId?: string }>;
	getState(): Promise<string>;
	remove(): Promise<void>;
}>;

export type AccountPipelineQueue = Readonly<{
	getJobs(states?: string[]): Promise<readonly CancellablePipelineJob[]>;
}>;

export type AccountPipelineCancellationDependencies = Readonly<{
	/** Atomically changes every non-terminal run owned by the actor to cancelled. */
	cancelRuns(actorUserId: string, signal?: AbortSignal): Promise<number>;
	queues: readonly AccountPipelineQueue[];
}>;

const REMOVABLE_STATES = ["waiting", "delayed", "paused", "prioritized"] as const;

/**
 * Fence active work durably, then remove only queue entries whose payload has
 * exact actor ownership metadata. BullMQ active jobs cannot be removed safely;
 * workers observe the durable fence before every write instead.
 */
export async function cancelAccountPipelineJobs(
	actorUserId: string,
	deps: AccountPipelineCancellationDependencies,
	signal?: AbortSignal,
): Promise<number> {
	if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
	let affected = await deps.cancelRuns(actorUserId, signal);
	for (const queue of deps.queues) {
		const jobs = await queue.getJobs([...REMOVABLE_STATES]);
		for (const job of jobs) {
			if (job.data?.ownerId !== actorUserId) continue;
			const state = await job.getState();
			if (!(REMOVABLE_STATES as readonly string[]).includes(state)) continue;
			try {
				await job.remove();
				affected += 1;
			} catch (error) {
				// A worker may claim/remove the job between state inspection and remove.
				// The durable run fence still prevents any subsequent write. BullMQ
				// reports these two expected claim/removal races as explicit messages.
				const message = error instanceof Error ? error.message.toLowerCase() : "";
				if (!message.includes("not found") && !message.includes("locked") && !message.includes("active")) throw error;
			}
		}
	}
	return affected;
}
