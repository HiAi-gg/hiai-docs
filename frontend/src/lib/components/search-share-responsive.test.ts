import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relative: string) =>
	readFileSync(resolve(import.meta.dir, relative), "utf8");

describe("search responsive containment", () => {
	test("search results wrap unbroken content inside the result card", () => {
		const source = read("SearchResult.svelte");
		expect(source).toContain("[overflow-wrap:anywhere]");
		expect(source).toContain("min-w-0 overflow-hidden");
	});

	test("mobile search field reserves space for the sidebar toggle", () => {
		const source = read("../hosts/HiaiDocsSearchHost.svelte");
		expect(source).toContain('class="search-form relative mb-6"');
		expect(source).toContain("margin-left: 56px");
	});

	test("mobile dashboard identity reserves space for the sidebar toggle", () => {
		const source = read("../hosts/HiaiDocsDashboardHost.svelte");
		expect(source).toContain(".dashboard-context-identity");
		expect(source).toContain("margin-left: 56px");
		expect(source).toContain(".dashboard-context-identity h1");
	});
});

describe("public share branding and actions", () => {
	test("uses DocsMint branding and groups mobile exports in a menu", () => {
		const source = read("../../routes/s/[token]/+page.svelte");
		expect(source).toContain('href="https://docsmint.com"');
		expect(source).toContain('src="/favicon.ico"');
		expect(source).toContain('class="sm:hidden"');
		expect(source).toContain("<DropdownMenuContent");
	});
});

describe("dashboard sharing entry points", () => {
	test("folder and document card menus can open the shared dialog", () => {
		const folderCard = read("FolderCard.svelte");
		const documentCard = read("DocumentCard.svelte");
		expect(folderCard).toContain("onShare?.(folder.id, folder.name)");
		expect(documentCard).toContain("onShare?.(doc.id, doc.title)");
		expect(folderCard).toContain("opacity-100 transition-opacity");
		expect(documentCard).toContain("opacity-100 transition-opacity");
	});

	test("dashboard category sections expose category sharing", () => {
		const source = read("../hosts/HiaiDocsDashboardHost.svelte");
		expect(source).toContain("openShareDialogForCategory");
		expect(source).toContain(
			'categoryId={shareTarget.kind === "category" ? shareTarget.categoryId : ""}',
		);
	});
});
