export interface EditorPreferences {
	showVisualMode: boolean;
	showMarkdownMode: boolean;
	showJsonMode: boolean;
	minimalToolbar: boolean;
	showScrollToTop: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: Readonly<EditorPreferences> = {
	showVisualMode: true,
	showMarkdownMode: true,
	showJsonMode: false,
	minimalToolbar: false,
	showScrollToTop: true,
};

export function normalizeEditorPreferences(value: unknown): EditorPreferences {
	if (!value || typeof value !== "object") {
		return { ...DEFAULT_EDITOR_PREFERENCES };
	}
	const candidate = value as Record<string, unknown>;
	return {
		showVisualMode:
			typeof candidate.showVisualMode === "boolean"
				? candidate.showVisualMode
				: DEFAULT_EDITOR_PREFERENCES.showVisualMode,
		showMarkdownMode:
			typeof candidate.showMarkdownMode === "boolean"
				? candidate.showMarkdownMode
				: DEFAULT_EDITOR_PREFERENCES.showMarkdownMode,
		showJsonMode:
			typeof candidate.showJsonMode === "boolean"
				? candidate.showJsonMode
				: DEFAULT_EDITOR_PREFERENCES.showJsonMode,
		minimalToolbar:
			typeof candidate.minimalToolbar === "boolean"
				? candidate.minimalToolbar
				: DEFAULT_EDITOR_PREFERENCES.minimalToolbar,
		showScrollToTop:
			typeof candidate.showScrollToTop === "boolean"
				? candidate.showScrollToTop
				: DEFAULT_EDITOR_PREFERENCES.showScrollToTop,
	};
}
