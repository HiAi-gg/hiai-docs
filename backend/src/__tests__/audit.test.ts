import { describe, expect, test } from "bun:test";

describe("audit", () => {
	test("recordAuditEvent exports a function", async () => {
		const mod = await import("../lib/audit");
		expect(typeof mod.recordAuditEvent).toBe("function");
	});

	test("recordAuditEvent runs without throwing (no DB = silent fail)", async () => {
		const mod = await import("../lib/audit");
		await expect(
			mod.recordAuditEvent({
				actorId: "00000000-0000-0000-0000-000000000001",
				action: "test",
				resourceType: "test",
			}),
		).resolves.toBeUndefined();
	});
});
