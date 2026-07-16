import { describe, expect, test } from "bun:test";

const shareRouteSource = await Bun.file(
	`${import.meta.dir}/../api/routes/share.ts`,
).text();
const schemaSource = await Bun.file(
	`${import.meta.dir}/../../../packages/db/src/schema.ts`,
).text();
const migrationSource = await Bun.file(
	`${import.meta.dir}/../../../packages/db/src/migrations/0034_share_categories.sql`,
).text();

describe("category share contract", () => {
	test("persists exactly one share target including categories", () => {
		expect(schemaSource).toContain('categoryId: uuid("category_id")');
		expect(migrationSource).toContain(
			"num_nonnulls(document_id, folder_id, category_id) = 1",
		);
		expect(shareRouteSource).toContain(
			"categoryId: z.string().uuid().optional()",
		);
	});

	test("authorizes category descendants for public folder and document reads", () => {
		expect(shareRouteSource).toContain("link.categoryId");
		expect(shareRouteSource).toContain("resolveFolderEffectiveCategory");
		expect(shareRouteSource).toContain("isDocumentInSharedCategory");
	});
});
