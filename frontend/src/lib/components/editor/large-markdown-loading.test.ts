import { describe, expect, test } from "bun:test";
import {
	LARGE_MARKDOWN_THRESHOLD,
	shouldDeferMarkdownParsing,
} from "./large-markdown";

describe("large markdown loading", () => {
	test("defers parsing only for genuinely large imported markdown", () => {
		expect(
			shouldDeferMarkdownParsing("x".repeat(LARGE_MARKDOWN_THRESHOLD)),
		).toBe(false);
		expect(
			shouldDeferMarkdownParsing("x".repeat(LARGE_MARKDOWN_THRESHOLD + 1)),
		).toBe(true);
	});
});
