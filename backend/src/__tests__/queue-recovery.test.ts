import { describe, expect, test } from "bun:test";
import {
	classifyPipelineError,
	type RecoverablePipelineJob,
	recoverStalledPipeline,
} from "../queue/recovery";

const candidate: RecoverablePipelineJob = {
	runId: "run-1",
	stage: "graph",
	attempts: 1,
	job: {
		schemaVersion: 1,
		stage: "graph",
		documentId: "11111111-1111-4111-8111-111111111111",
		ownerId: "22222222-2222-4222-8222-222222222222",
		generationId: "33333333-3333-4333-8333-333333333333",
		revision: "rev-1",
		requestedAt: new Date().toISOString(),
		source: "import",
	},
};

describe("pipeline recovery", () => {
	test("classifies transient provider and infrastructure failures", () => {
		expect(classifyPipelineError({ status: 429, code: "rate_limit" })).toEqual({
			code: "rate_limit",
			retryable: true,
		});
		expect(classifyPipelineError(new Error("invalid payload"))).toEqual({
			code: "Error",
			retryable: false,
		});
		expect(
			classifyPipelineError({ code: "provider_circuit_open" }).retryable,
		).toBe(true);
	});

	test("claims and requeues stalled jobs with deterministic ids", async () => {
		const queued: Array<Record<string, unknown>> = [];
		const result = await recoverStalledPipeline(
			{
				findStalled: async () => [candidate],
				claimRetry: async () => true,
				markExhausted: async () => undefined,
			},
			{ add: async (_stage, _name, _job, options) => queued.push(options) },
			{ now: new Date(1_000_000) },
		);
		expect(result).toEqual({ recovered: 1, exhausted: 0 });
		expect(queued[0]?.jobId).toBe(`graph-${candidate.job.generationId}`);
	});

	test("marks exhausted runs without requeueing", async () => {
		let exhausted = "";
		const result = await recoverStalledPipeline(
			{
				findStalled: async () => [{ ...candidate, attempts: 5 }],
				claimRetry: async () => true,
				markExhausted: async ({ errorCode }) => {
					exhausted = errorCode;
				},
			},
			{
				add: async () => {
					throw new Error("must not enqueue");
				},
			},
		);
		expect(result).toEqual({ recovered: 0, exhausted: 1 });
		expect(exhausted).toBe("recovery_attempts_exhausted");
	});
});
