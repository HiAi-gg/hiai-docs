import { describe, expect, test } from "bun:test";

import {
	createUserDataLifecycle,
	encodeUserDataExportNdjson,
	orderLifecycleHostSteps,
	type PurgeUserDataContext,
	type UserDataExportRecord,
} from "./lifecycle.js";

async function* records(): AsyncIterable<UserDataExportRecord> {
	yield {
		type: "manifest",
		schemaVersion: 1,
		exportId: "export-1",
		actorUserId: "user-1",
		generatedAt: "2026-07-16T00:00:00.000Z",
	};
	yield {
		type: "data",
		domain: "documents",
		resourceType: "document",
		resourceId: "doc-1",
		workspaceId: null,
		payload: { title: "Private" },
	};
	yield { type: "complete", recordCount: 2, checksum: "abc" };
}

describe("encodeUserDataExportNdjson", () => {
	test("emits one newline-terminated JSON record per source record", async () => {
		const stream = encodeUserDataExportNdjson(records());
		const text = await new Response(stream).text();
		const lines = text.trimEnd().split("\n");

		expect(lines).toHaveLength(3);
		expect(JSON.parse(lines[0] ?? "")).toMatchObject({ type: "manifest" });
		expect(JSON.parse(lines[2] ?? "")).toMatchObject({
			type: "complete",
			recordCount: 2,
			checksum: "abc",
		});
		expect(text.endsWith("\n")).toBe(true);
	});

	test("rejects a partial stream without a terminal complete record", async () => {
		async function* incomplete(): AsyncIterable<UserDataExportRecord> {
			yield {
				type: "manifest",
				schemaVersion: 1,
				exportId: "export-1",
				actorUserId: "user-1",
				generatedAt: "2026-07-16T00:00:00.000Z",
			};
		}

		await expect(new Response(encodeUserDataExportNdjson(incomplete())).text()).rejects.toThrow(
			"without complete",
		);
	});

	test("rejects a stream whose first record is not manifest", async () => {
		async function* invalid(): AsyncIterable<UserDataExportRecord> {
			yield {
				type: "data",
				domain: "documents",
				resourceType: "document",
				resourceId: "doc-1",
				workspaceId: null,
				payload: {},
			};
		}

		await expect(
			new Response(encodeUserDataExportNdjson(invalid())).text(),
		).rejects.toThrow("begin with manifest");
	});

	test("rejects records emitted after the terminal complete record", async () => {
		async function* invalid(): AsyncIterable<UserDataExportRecord> {
			yield {
				type: "manifest",
				schemaVersion: 1,
				exportId: "export-1",
				actorUserId: "user-1",
				generatedAt: "2026-07-16T00:00:00.000Z",
			};
			yield { type: "complete", recordCount: 1, checksum: "abc" };
			yield {
				type: "data",
				domain: "documents",
				resourceType: "document",
				resourceId: "doc-1",
				workspaceId: null,
				payload: {},
			};
		}

		await expect(
			new Response(encodeUserDataExportNdjson(invalid())).text(),
		).rejects.toThrow("after complete");
	});
});

const purgeContext: PurgeUserDataContext = {
	actorUserId: "018f37c8-6b15-7b9e-8c44-9e4a86cf1161",
	requestId: "request-1",
	idempotencyKey: "purge-1",
	reason: "account_deletion",
};

describe("createUserDataLifecycle", () => {
	test("runs the final-owner gate before invoking the purge adapter", async () => {
		const calls: string[] = [];
		const lifecycle = createUserDataLifecycle(
			{
				async *exportUserData() {},
				async purgeUserData(ctx, gate) {
					calls.push("adapter");
					expect(Object.isFrozen(ctx)).toBe(true);
					expect(gate.fenceToken).toBe("fence-1");
					return {
						status: "completed",
						operationId: "operation-1",
						deletedByDomain: {},
					};
				},
			},
			async (ctx) => {
				calls.push("gate");
				expect(Object.isFrozen(ctx)).toBe(true);
				return { fenceToken: "fence-1" };
			},
		);

		await lifecycle.purgeUserData(purgeContext);
		expect(calls).toEqual(["gate", "adapter"]);
	});

	test("fails closed when the gate rejects", async () => {
		let adapterCalled = false;
		const lifecycle = createUserDataLifecycle(
			{
				async *exportUserData() {},
				async purgeUserData() {
					adapterCalled = true;
					throw new Error("must not run");
				},
			},
			async () => {
				throw new Error("final_owner");
			},
		);

		await expect(lifecycle.purgeUserData(purgeContext)).rejects.toThrow(
			"final_owner",
		);
		expect(adapterCalled).toBe(false);
	});

	test("rejects an empty fence token before mutation", async () => {
		let adapterCalled = false;
		const lifecycle = createUserDataLifecycle(
			{
				async *exportUserData() {},
				async purgeUserData() {
					adapterCalled = true;
					throw new Error("must not run");
				},
			},
			async () => ({ fenceToken: "" }),
		);

		await expect(lifecycle.purgeUserData(purgeContext)).rejects.toThrow(
			"empty fence token",
		);
		expect(adapterCalled).toBe(false);
	});
});

describe("orderLifecycleHostSteps", () => {
	test("orders deterministically by order and then ID", () => {
		const result = orderLifecycleHostSteps([
			{ id: "usage", order: 20 },
			{ id: "consents", order: 10 },
			{ id: "ai-runs", order: 20 },
		]);
		expect(result.map((step) => step.id)).toEqual([
			"consents",
			"ai-runs",
			"usage",
		]);
		expect(Object.isFrozen(result)).toBe(true);
	});

	test("rejects duplicate and empty IDs", () => {
		expect(() =>
			orderLifecycleHostSteps([
				{ id: "usage", order: 10 },
				{ id: "usage", order: 20 },
			]),
		).toThrow("Duplicate");
		expect(() => orderLifecycleHostSteps([{ id: "", order: 10 }])).toThrow(
			"empty",
		);
	});
});
