import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const toolbarSource = readFileSync(
	new URL("./EditorToolbar.svelte", import.meta.url),
	"utf8",
);
const editorSource = readFileSync(
	new URL("./HiAiEditor.svelte", import.meta.url),
	"utf8",
);
const markdownSource = readFileSync(
	new URL("./MarkdownToggle.svelte", import.meta.url),
	"utf8",
);

describe("editor theme presentation", () => {
	test("darkens portable highlight colors without changing their stored values", () => {
		expect(toolbarSource).toContain("rgb(0 0 0 / 62%)");
		expect(toolbarSource).toContain("background-blend-mode: multiply");
		expect(editorSource).toContain(":global(.dark) .editor-content");
		expect(editorSource).toContain("color: #fff");
	});

	test("raw Markdown fills the canonical editor container and grows with its content", () => {
		expect(markdownSource).toContain("height: 100%");
		expect(markdownSource).toContain("min-height: 0");
		expect(markdownSource).toContain("resize: vertical");
		expect(markdownSource).toContain("textarea.scrollHeight");
		expect(markdownSource).toContain('textarea.style.height = "auto"');
		expect(markdownSource).toContain("display: block; flex: none");
		expect(markdownSource).toContain(
			"position: relative; display: flex; flex: 1",
		);
	});
});
