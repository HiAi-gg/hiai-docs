import { describe, expect, test } from "bun:test";
import {
	DEFAULT_EDITOR_PREFERENCES,
	normalizeEditorPreferences,
} from "./editor-preferences";

describe("editor preferences", () => {
	test("preserves the existing editor experience by default", () => {
		expect(DEFAULT_EDITOR_PREFERENCES).toEqual({
			showVisualMode: true,
			showMarkdownMode: true,
			minimalToolbar: false,
			showScrollToTop: true,
		});
	});

	test("normalizes partial or malformed persisted values", () => {
		expect(
			normalizeEditorPreferences({
				showVisualMode: false,
				showMarkdownMode: false,
				showJsonMode: true,
				minimalToolbar: true,
				showScrollToTop: false,
			}),
		).toEqual({
			showVisualMode: true,
			showMarkdownMode: false,
			minimalToolbar: true,
			showScrollToTop: false,
		});

		expect(normalizeEditorPreferences({ showJsonMode: true })).toEqual(
			DEFAULT_EDITOR_PREFERENCES,
		);
		expect(normalizeEditorPreferences(null)).toEqual(
			DEFAULT_EDITOR_PREFERENCES,
		);
	});
});
