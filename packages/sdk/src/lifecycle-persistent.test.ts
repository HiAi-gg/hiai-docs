import { expect, test } from "bun:test";

import { createPersistentLifecycleRuntime } from "./lifecycle-persistent.js";

test("persistent lifecycle uses the injected scoped database executor", async () => {
	let executions = 0;
	let purges = 0;
	const lifecycle = createPersistentLifecycleRuntime({
		runtime: {
			database: async (_context, operation) => {
				executions += 1;
				return operation();
			},
			adapter: {
				async *exportUserData(ctx) {
					yield {
						type: "manifest",
						schemaVersion: 1,
						exportId: "test",
						actorUserId: ctx.actorUserId,
						generatedAt: "2026-01-01T00:00:00.000Z",
					} as const;
					yield {
						type: "complete",
						recordCount: 1,
						checksum: "checksum",
					} as const;
				},
				async purgeUserData() {
					purges += 1;
					return {
						status: "completed",
						operationId: "operation",
						deletedByDomain: {},
					} as const;
				},
			},
		},
		assertPurgeAllowed: async () => ({ fenceToken: "fence" }),
	});

	const records = [];
	for await (const record of lifecycle.exportUserData({
		actorUserId: "actor",
		requestId: "request",
		idempotencyKey: "export",
		reason: "privacy_request",
	}))
		records.push(record);
	expect(records).toHaveLength(2);
	await lifecycle.purgeUserData({
		actorUserId: "actor",
		requestId: "request",
		idempotencyKey: "purge",
		reason: "account_deletion",
	});
	expect(executions).toBe(2);
	expect(purges).toBe(1);
});

test("persistent lifecycle composes ordered host export and purge steps", async () => {
	const events: string[] = [];
	const lifecycle = createPersistentLifecycleRuntime({
		runtime: {
			database: async (_context, operation) => operation(),
			adapter: {
				async *exportUserData() {
					yield {
						type: "manifest",
						schemaVersion: 1,
						exportId: "test",
						actorUserId: "actor",
						generatedAt: "2026-01-01T00:00:00.000Z",
					} as const;
					yield { type: "complete", recordCount: 1, checksum: "obsolete" } as const;
				},
				async purgeUserData() {
					events.push("oss");
					return { status: "completed", operationId: "operation", deletedByDomain: {} } as const;
				},
			},
		},
		assertPurgeAllowed: async () => ({ fenceToken: "fence" }),
		hostSteps: [
			{
				id: "later",
				order: 20,
				export: async function* () {
					yield { type: "data", domain: "host", resourceType: "later", resourceId: null, workspaceId: null, payload: {} } as const;
				},
				purge: async () => {
					events.push("later");
					return { deletedCount: 2 };
				},
			},
			{
				id: "first",
				order: 10,
				export: async function* () {
					yield { type: "data", domain: "host", resourceType: "first", resourceId: null, workspaceId: null, payload: {} } as const;
				},
				purge: async () => {
					events.push("first");
					return { deletedCount: 1 };
				},
			},
		],
	});

	const records = [];
	for await (const record of lifecycle.exportUserData({
		actorUserId: "actor", requestId: "request", idempotencyKey: "export", reason: "privacy_request",
	})) records.push(record);
	expect(records.map((record) => record.type)).toEqual(["manifest", "data", "data", "complete"]);
	expect(records.at(-1)).toMatchObject({ type: "complete", recordCount: 3 });
	const result = await lifecycle.purgeUserData({
		actorUserId: "actor", requestId: "request", idempotencyKey: "purge", reason: "account_deletion",
	});
	expect(events).toEqual(["oss", "first", "later"]);
	expect(result.deletedByDomain).toEqual({ "host:first": 1, "host:later": 2 });
});
