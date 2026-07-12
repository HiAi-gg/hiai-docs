import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
	new URL("./migrations/0032_unique_sibling_folder_names.sql", import.meta.url),
	"utf8",
);
const journal = JSON.parse(
	readFileSync(
		new URL("./migrations/meta/_journal.json", import.meta.url),
		"utf8",
	),
) as { entries: Array<{ idx: number; tag: string }> };

describe("sibling folder name migration", () => {
	it("normalizes legacy duplicates before creating scoped unique indexes", () => {
		expect(migration).toContain("row_number() OVER");
		expect(migration).toContain("duplicate_number > 1");
		expect(migration).toContain("folders_unique_child_name_idx");
		expect(migration).toContain("folders_unique_root_category_name_idx");
		expect(migration).toContain("folders_unique_root_uncategorized_name_idx");
		expect(migration.indexOf("UPDATE public.folders")).toBeLessThan(
			migration.indexOf('CREATE UNIQUE INDEX "folders_unique_child_name_idx"'),
		);
	});

	it("is the latest journaled migration", () => {
		expect(journal.entries.at(-1)).toMatchObject({
			idx: 32,
			tag: "0032_unique_sibling_folder_names",
		});
	});
});
