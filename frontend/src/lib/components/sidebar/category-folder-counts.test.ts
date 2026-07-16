import { expect, test } from "bun:test";

const source = await Bun.file(`${import.meta.dir}/FolderTree.svelte`).text();

test("category headers do not display folder counts", () => {
	expect(source).not.toContain("{bucket.folders.length}");
	expect(source).not.toContain("{uncatBucket.folders.length}");
});
