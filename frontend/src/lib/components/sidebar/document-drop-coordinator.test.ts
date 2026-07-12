import { describe, expect, test } from "bun:test";
import {
	createDocumentDropCoordinator,
	createDocumentPlacementWriter,
} from "./document-drop-coordinator";

function deferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("sidebar document placement writer", () => {
	test("serializes rapid writes and an old failure cannot roll back the latest", async () => {
		const first = deferred();
		const calls: string[] = [];
		const rollbacks: string[] = [];
		const writer = createDocumentPlacementWriter({
			patch: async (_id, placement) => {
				calls.push(placement.folderId ?? "root");
				if (placement.folderId === "one") await first.promise;
			},
			optimistic: () => 1,
			acknowledge: () => {},
			rollback: (_id, placement) =>
				rollbacks.push(placement.folderId ?? "root"),
			refresh: async () => {},
			onError: () => {},
		});
		const v1 = writer(
			"doc",
			{ folderId: "one", categoryId: null },
			{ folderId: "old", categoryId: null },
		);
		const v2 = writer(
			"doc",
			{ folderId: "two", categoryId: null },
			{ folderId: "old", categoryId: null },
		);
		await Promise.resolve();
		expect(calls).toEqual(["one"]);
		first.reject(new Error("old failed"));
		await Promise.allSettled([v1, v2]);
		expect(calls).toEqual(["one", "two"]);
		expect(rollbacks).toEqual([]);
	});

	test("does not roll back a committed PATCH when refresh fails", async () => {
		const rollbacks: string[] = [];
		const errors: unknown[] = [];
		const writer = createDocumentPlacementWriter({
			patch: async () => {},
			optimistic: () => 7,
			acknowledge: () => {},
			rollback: (_id, placement) =>
				rollbacks.push(placement.folderId ?? "root"),
			refresh: async () => {
				throw new Error("refresh failed");
			},
			onError: (error) => errors.push(error),
			onRefreshError: (error) => errors.push(error),
		});
		await writer(
			"doc",
			{ folderId: "new", categoryId: null },
			{ folderId: "old", categoryId: null },
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(rollbacks).toEqual([]);
		expect(errors).toHaveLength(1);
	});
});

describe("document drop coordinator", () => {
	test("header claim cancels deferred zone persistence and emits one target", () => {
		const tasks: Array<() => void> = [];
		const cancelled = new Set<() => void>();
		const writes: string[] = [];
		const coordinator = createDocumentDropCoordinator({
			persist: (_id, placement) =>
				writes.push(placement.folderId ?? placement.categoryId ?? "root"),
			defer: (callback) => {
				tasks.push(callback);
				return callback as unknown as ReturnType<typeof setTimeout>;
			},
			cancel: (handle) => cancelled.add(handle as unknown as () => void),
		});
		coordinator.zone("doc", { folderId: "source", categoryId: null });
		coordinator.header("doc", { folderId: "target", categoryId: null });
		for (const task of tasks) if (!cancelled.has(task)) task();
		expect(writes).toEqual(["target"]);
	});
});
