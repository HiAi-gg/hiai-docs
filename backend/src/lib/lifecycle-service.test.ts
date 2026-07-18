import { expect, test } from "bun:test";
import {
	createPersistentLifecycleRuntime,
	LifecycleLeaseLostError,
	requireLeaseWrite,
} from "./lifecycle-service";

const context = {
	actorUserId: "018f37c8-6b15-7b9e-8c44-9e4a86cf1161",
	requestId: "request-lifecycle-runtime",
	idempotencyKey: "lifecycle-runtime-gate",
	reason: "account_deletion" as const,
};

test("persistent lifecycle runtime fails closed before any OSS mutation when the host fence rejects", async () => {
	let runtimeCalled = false;
	const lifecycle = createPersistentLifecycleRuntime({
		database: {
			async withActorTransaction() {
				throw new Error("Database must not be reached before the host gate");
			},
		},
		runtime: {
			async verifyPurgeFence() {
				runtimeCalled = true;
			},
			async deleteObjects() {
				runtimeCalled = true;
				return 0;
			},
			async cancelAccountJobs() {
				runtimeCalled = true;
				return 0;
			},
			async clearAccountRedisState() {
				runtimeCalled = true;
				return 0;
			},
			async removeCollaborationState() {
				runtimeCalled = true;
				return 0;
			},
			async removeGraphState() {
				runtimeCalled = true;
				return 0;
			},
		},
		async assertPurgeAllowed() {
			throw new Error("final_owner");
		},
	});

	await expect(lifecycle.purgeUserData(context)).rejects.toThrow("final_owner");
	expect(runtimeCalled).toBe(false);
});

test("lease-fenced writes fail closed when a concurrent worker wins", () => {
	expect(() => requireLeaseWrite([])).toThrow(LifecycleLeaseLostError);
	expect(() =>
		requireLeaseWrite([{ id: "operation-1" }, { id: "operation-2" }]),
	).toThrow(LifecycleLeaseLostError);
	expect(() => requireLeaseWrite([{ id: "operation-1" }])).not.toThrow();
});
