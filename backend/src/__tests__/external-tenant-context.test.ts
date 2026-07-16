import { describe, expect, test } from "bun:test";
import {
	createExternalTenantAssertion,
	verifyExternalTenantAssertion,
} from "../lib/external-tenant-context";

const context = {
	actorUserId: "user-1",
	workspaceId: "workspace-1",
	actorRole: "editor" as const,
	issuedAt: 1_700_000_000,
	expiresAt: 1_700_000_600,
	issuer: "docs-mint",
};

describe("external tenant context assertions", () => {
	test("verifies a signed assertion and preserves its typed context", async () => {
		const assertion = await createExternalTenantAssertion(context, "secret");
		expect(
			await verifyExternalTenantAssertion(assertion, {
				secret: "secret",
				issuer: "docs-mint",
				nowSeconds: context.issuedAt + 10,
			}),
		).toEqual(context);
	});

	test("rejects tampering, expiry, and an unexpected issuer", async () => {
		const assertion = await createExternalTenantAssertion(context, "secret");
		await expect(
			verifyExternalTenantAssertion(assertion, {
				secret: "wrong",
				issuer: "docs-mint",
				nowSeconds: context.issuedAt + 10,
			}),
		).rejects.toThrow("signature");
		await expect(
			verifyExternalTenantAssertion(assertion, {
				secret: "secret",
				issuer: "docs-mint",
				nowSeconds: context.expiresAt + 6,
			}),
		).rejects.toThrow("expired");
		await expect(
			verifyExternalTenantAssertion(assertion, {
				secret: "secret",
				issuer: "other-host",
				nowSeconds: context.issuedAt + 10,
			}),
		).rejects.toThrow("issuer");
	});

	test("rejects an assertion without a workspace id", async () => {
		await expect(
			createExternalTenantAssertion({ ...context, workspaceId: "" }, "secret"),
		).rejects.toThrow("workspaceId");
	});
});
