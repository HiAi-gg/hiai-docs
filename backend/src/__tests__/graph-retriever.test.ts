import { describe, expect, test } from "bun:test";
import type { TenantContext } from "@hiai-docs/db/with-tenant";

const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

describe("graph visibility scope", () => {
	test("includes public documents without exposing another private owner", async () => {
		const { _buildGraphVisibilityScope, _isGraphDocumentVisible } =
			await import("../search/graph-retriever");
		const ctx: TenantContext = { userId: OWNER, role: "user" };
		const scope = _buildGraphVisibilityScope(ctx);

		expect(scope).toEqual({
			kind: "tenant",
			ownerId: OWNER,
			includePublic: true,
		});
		expect(
			_isGraphDocumentVisible(scope, {
				id: "public-doc",
				ownerId: OTHER,
				visibility: "public",
			}),
		).toBe(true);
		expect(
			_isGraphDocumentVisible(scope, {
				id: "private-doc",
				ownerId: OTHER,
				visibility: "private",
			}),
		).toBe(false);
	});

	test("supports explicit share scopes and public-only contexts", async () => {
		const { _buildGraphVisibilityScope, _isGraphDocumentVisible } =
			await import("../search/graph-retriever");
		const shareScope = _buildGraphVisibilityScope(
			{ userId: OWNER, role: "user" },
			{ kind: "share", ownerId: OWNER, allowedDocumentIds: ["shared-doc"] },
		);
		expect(
			_isGraphDocumentVisible(shareScope, {
				id: "shared-doc",
				ownerId: OTHER,
				visibility: "private",
			}),
		).toBe(true);
		expect(
			_isGraphDocumentVisible(shareScope, {
				id: "other-doc",
				ownerId: OTHER,
				visibility: "private",
			}),
		).toBe(false);

		const publicScope = _buildGraphVisibilityScope({
			userId: "00000000-0000-0000-0000-000000000000",
			role: "none",
		});
		expect(publicScope).toEqual({ kind: "public" });
		expect(
			_isGraphDocumentVisible(publicScope, {
				id: "public-doc",
				ownerId: OTHER,
				visibility: "public",
			}),
		).toBe(true);
		expect(
			_isGraphDocumentVisible(publicScope, {
				id: "private-doc",
				ownerId: OWNER,
				visibility: "private",
			}),
		).toBe(false);
	});
});
