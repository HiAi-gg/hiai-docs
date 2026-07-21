import { describe, expect, test } from "bun:test";
import { cancelAccountPipelineJobs } from "./account-cancellation";

function job(ownerId: string, state: string) {
	let removed = 0;
	return {
		data: { ownerId },
		async getState() {
			return state;
		},
		async remove() {
			removed++;
		},
		get removed() {
			return removed;
		},
	};
}

describe("account pipeline cancellation", () => {
	test("fences durable runs before removing only owned waiting and delayed jobs", async () => {
		const waiting = job("owner-a", "waiting");
		const delayed = job("owner-a", "delayed");
		const active = job("owner-a", "active");
		const other = job("owner-b", "waiting");
		const order: string[] = [];
		const count = await cancelAccountPipelineJobs("owner-a", {
			async cancelRuns(ownerId) {
				order.push(`fence:${ownerId}`);
				return 3;
			},
			queues: [
				{
					async getJobs() {
						order.push("scan");
						return [waiting, delayed, active, other];
					},
				},
			],
		});
		expect(order).toEqual(["fence:owner-a", "scan"]);
		expect([
			waiting.removed,
			delayed.removed,
			active.removed,
			other.removed,
		]).toEqual([1, 1, 0, 0]);
		expect(count).toBe(5);
	});

	test("is idempotent when jobs were already removed and runs already cancelled", async () => {
		const gone = job("owner-a", "unknown");
		const deps = {
			async cancelRuns() {
				return 0;
			},
			queues: [
				{
					async getJobs() {
						return [gone];
					},
				},
			],
		};
		expect(await cancelAccountPipelineJobs("owner-a", deps)).toBe(0);
		expect(await cancelAccountPipelineJobs("owner-a", deps)).toBe(0);
	});

	test("propagates unexpected queue removal failures", async () => {
		const broken = job("owner-a", "waiting");
		broken.remove = async () => {
			throw new Error("redis unavailable");
		};
		await expect(
			cancelAccountPipelineJobs("owner-a", {
				cancelRuns: async () => 1,
				queues: [{ getJobs: async () => [broken] }],
			}),
		).rejects.toThrow("redis unavailable");
	});
});
