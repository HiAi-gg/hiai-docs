import { describe, expect, test } from "bun:test";
import {
	removeUnavailableAttachmentImages,
	sanitizeEditorContent,
} from "./editor-content-sanitizer";

describe("editor content sanitizer", () => {
	test("removes block images nested inside paragraphs", () => {
		const result = sanitizeEditorContent({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Before" },
						{ type: "image", attrs: { src: "/api/attachments/missing/raw" } },
					],
				},
			],
		});

		expect(result).toEqual({
			type: "doc",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "Before" }] },
			],
		});
	});

	test("removes only attachment images whose raw endpoint is unavailable", async () => {
		const source = {
			type: "doc",
			content: [
				{
					type: "image",
					attrs: {
						src: "/api/attachments/00000000-0000-0000-0000-000000000001/raw",
					},
				},
				{
					type: "image",
					attrs: {
						src: "/api/attachments/00000000-0000-0000-0000-000000000002/raw",
					},
				},
			],
		};
		const result = await removeUnavailableAttachmentImages(
			source,
			async (input) =>
				new Response(null, {
					status: String(input).includes("000000000001") ? 404 : 200,
				}),
		);

		expect(result.removed).toBe(1);
		expect(result.content.content).toHaveLength(1);
	});
});
