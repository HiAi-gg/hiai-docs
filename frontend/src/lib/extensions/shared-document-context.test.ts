import { describe, expect, test } from "bun:test";

import { sanitizeSharedDocumentExtensionContext } from "./shared-document-context";

const base = {
	documentId: "document-1",
	title: "Shared document",
	content: "# Shared document",
	role: "commenter" as const,
	capability: { id: "capability-1", expiresAt: "2026-07-18T20:00:00.000Z" },
	permissions: {
		read: true as const,
		annotate: true,
		edit: false,
		export: true,
	},
};

describe("shared document extension context", () => {
	test("passes only a frozen narrow capability for viewer/commenter/editor rendering", () => {
		for (const role of ["viewer", "commenter", "editor"] as const) {
			const context = sanitizeSharedDocumentExtensionContext({ ...base, role });
			expect(context.role).toBe(role);
			expect(context.capability).toEqual(base.capability);
			expect(Object.isFrozen(context)).toBe(true);
			expect(Object.isFrozen(context.capability)).toBe(true);
		}
	});

	test("rejects bearer tokens and every other sensitive extension field at runtime", () => {
		for (const key of [
			"shareToken",
			"password",
			"passwordHash",
			"workspaceAssertion",
			"authorization",
			"cookie",
			"signingSecret",
		]) {
			expect(() =>
				sanitizeSharedDocumentExtensionContext({
					...base,
					[key]: "sensitive-value",
				} as typeof base),
			).toThrow(key);
		}
	});
});
