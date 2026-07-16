import { describe, expect, test } from "bun:test";

import {
	createDocsmintWorkspaceAssertion,
	verifyDocsmintWorkspaceAssertion,
} from "./workspace.js";

const context = {
	actorUserId: "018f37c8-6b15-7b9e-8c44-9e4a86cf1161",
	workspaceId: "ws_opaque_123",
	actorRole: "owner" as const,
	issuedAt: 1_700_000_000,
	expiresAt: 1_700_000_120,
	issuer: "docsmint-com",
};
const options = { secret: "test-secret", issuer: "docsmint-com", nowSeconds: 1_700_000_030 };

async function signedPayload(payload: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(options.secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	return `${payload}.${Buffer.from(signature).toString("base64url")}`;
}

describe("workspace assertions", () => {
	test("signs and verifies an HMAC assertion", async () => {
		const assertion = await createDocsmintWorkspaceAssertion(context, options.secret);
		await expect(verifyDocsmintWorkspaceAssertion(assertion, options)).resolves.toEqual(context);
	});

	test("rejects an extra segment, a wrong secret, and a future assertion", async () => {
		const assertion = await createDocsmintWorkspaceAssertion(context, options.secret);
		await expect(verifyDocsmintWorkspaceAssertion(`${assertion}.extra`, options)).rejects.toThrow();
		await expect(verifyDocsmintWorkspaceAssertion(assertion, { ...options, secret: "wrong" })).rejects.toThrow();
		const future = await createDocsmintWorkspaceAssertion({ ...context, issuedAt: 1_700_001_000, expiresAt: 1_700_001_120 }, options.secret);
		await expect(verifyDocsmintWorkspaceAssertion(future, options)).rejects.toThrow();
	});

	test("rejects wrong issuer, expired assertions, and excessive TTL", async () => {
		const wrongIssuer = await createDocsmintWorkspaceAssertion(
			{ ...context, issuer: "other-host" },
			options.secret,
		);
		await expect(
			verifyDocsmintWorkspaceAssertion(wrongIssuer, options),
		).rejects.toThrow("issuer");

		const expired = await createDocsmintWorkspaceAssertion(
			{ ...context, issuedAt: 1_699_999_000, expiresAt: 1_699_999_100 },
			options.secret,
		);
		await expect(
			verifyDocsmintWorkspaceAssertion(expired, options),
		).rejects.toThrow("lifetime");

		const excessiveTtl = await createDocsmintWorkspaceAssertion(
			{ ...context, expiresAt: context.issuedAt + 301 },
			options.secret,
		);
		await expect(
			verifyDocsmintWorkspaceAssertion(excessiveTtl, options),
		).rejects.toThrow("lifetime");
	});

	test("accepts only the documented five-second clock skew", async () => {
		const withinSkew = await createDocsmintWorkspaceAssertion(
			{ ...context, issuedAt: options.nowSeconds + 5, expiresAt: options.nowSeconds + 30 },
			options.secret,
		);
		await expect(
			verifyDocsmintWorkspaceAssertion(withinSkew, options),
		).resolves.toMatchObject({ actorUserId: context.actorUserId });

		const outsideSkew = await createDocsmintWorkspaceAssertion(
			{ ...context, issuedAt: options.nowSeconds + 6, expiresAt: options.nowSeconds + 30 },
			options.secret,
		);
		await expect(
			verifyDocsmintWorkspaceAssertion(outsideSkew, options),
		).rejects.toThrow("lifetime");
	});

	test("rejects malformed base64url, malformed JSON, invalid role, and missing workspace", async () => {
		await expect(
			verifyDocsmintWorkspaceAssertion("%%%.signature", options),
		).rejects.toThrow();

		const malformedJsonPayload = Buffer.from("{", "utf8").toString("base64url");
		await expect(
			verifyDocsmintWorkspaceAssertion(
				await signedPayload(malformedJsonPayload),
				options,
			),
		).rejects.toThrow("payload");

		await expect(
			createDocsmintWorkspaceAssertion(
				{ ...context, actorRole: "billing" } as typeof context,
				options.secret,
			),
		).rejects.toThrow("actorRole");
		await expect(
			createDocsmintWorkspaceAssertion(
				{ ...context, workspaceId: "" },
				options.secret,
			),
		).rejects.toThrow("workspaceId");
	});
});
