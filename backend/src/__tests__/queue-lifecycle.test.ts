import { describe, expect, test } from "bun:test";
import {
	type ManagedPipelineWorker,
	startPipelineWorkers,
} from "../queue/start";

function worker(events: string[], stage: string): ManagedPipelineWorker {
	return {
		async waitUntilReady() {
			events.push(`${stage}:ready`);
		},
		async pause(doNotWaitActive) {
			events.push(`${stage}:pause:${String(doNotWaitActive)}`);
		},
		async close(force) {
			events.push(`${stage}:close:${String(force)}`);
		},
	};
}

describe("pipeline worker lifecycle", () => {
	test("runs recovery before factories accept jobs and registers stages independently", async () => {
		const events: string[] = [];
		const runtime = await startPipelineWorkers({
			async recover() {
				events.push("recover");
			},
			workerFactories: {
				prepare: () => {
					events.push("prepare:factory");
					return worker(events, "prepare");
				},
				embed: () => {
					events.push("embed:factory");
					return worker(events, "embed");
				},
			},
			async closeQueues() {
				events.push("queues:close");
			},
		});
		expect(events).toEqual([
			"recover",
			"prepare:factory",
			"prepare:ready",
			"embed:factory",
			"embed:ready",
		]);
		expect([...runtime.workers.keys()]).toEqual(["prepare", "embed"]);
		await runtime.close();
	});

	test("pauses intake, grants active work a grace period, and closes resources in order", async () => {
		const events: string[] = [];
		const runtime = await startPipelineWorkers({
			async recover() {},
			workerFactories: { embed: () => worker(events, "embed") },
			queues: {
				embed: {
					async pause() {
						events.push("queue:pause");
					},
				},
			},
			async closeQueues() {
				events.push("queues:close");
			},
			async closeConnections() {
				events.push("connections:close");
			},
		});
		events.length = 0;
		await runtime.close();
		expect(events).toEqual([
			"queue:pause",
			"embed:pause:true",
			"embed:close:false",
			"queues:close",
			"connections:close",
		]);
	});

	test("forces worker closure after the grace deadline and close is idempotent", async () => {
		const events: string[] = [];
		let resolveGraceful: (() => void) | undefined;
		const slowWorker: ManagedPipelineWorker = {
			async close(force) {
				events.push(`close:${String(force)}`);
				if (!force)
					await new Promise<void>((resolve) => (resolveGraceful = resolve));
			},
		};
		const runtime = await startPipelineWorkers({
			async recover() {},
			workerFactories: { graph: () => slowWorker },
			async closeQueues() {
				events.push("queues:close");
			},
			shutdownGraceMs: 1,
			sleep: async () => {},
		});
		const first = runtime.close();
		const second = runtime.close();
		expect(first).toBe(second);
		await first;
		resolveGraceful?.();
		expect(events).toEqual(["close:false", "close:true", "queues:close"]);
	});

	test("cleans already-started workers when a later factory fails", async () => {
		const events: string[] = [];
		await expect(
			startPipelineWorkers({
				async recover() {},
				workerFactories: {
					prepare: () => worker(events, "prepare"),
					embed: () => {
						throw new Error("embed startup failed");
					},
				},
				async closeQueues() {
					events.push("queues:close");
				},
			}),
		).rejects.toThrow("embed startup failed");
		expect(events).toContain("prepare:close:true");
		expect(events).toContain("queues:close");
	});
});
