import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("document breadcrumb mobile spacing", () => {
	test("reserves space for the fixed sidebar toggle", () => {
		const source = readFileSync(
			resolve(import.meta.dir, "../../../routes/(app)/docs/[id]/+page.svelte"),
			"utf8",
		);

		expect(source).toContain("@media (max-width: 767px)");
		expect(source).toContain("padding-left: 56px");
		expect(source).toContain("max-width: calc(100% - 56px)");
	});
});
