export interface EditorPreferences {
	showVisualMode: boolean;
	showMarkdownMode: boolean;
	minimalToolbar: boolean;
	showScrollToTop: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: Readonly<EditorPreferences> = {
	showVisualMode: true,
	showMarkdownMode: true,
	minimalToolbar: false,
	showScrollToTop: true,
};

export function normalizeEditorPreferences(value: unknown): EditorPreferences {
	if (!value || typeof value !== "object") {
		return { ...DEFAULT_EDITOR_PREFERENCES };
	}
	const candidate = value as Record<string, unknown>;
	const requestedVisualMode =
		typeof candidate.showVisualMode === "boolean"
			? candidate.showVisualMode
			: DEFAULT_EDITOR_PREFERENCES.showVisualMode;
	const showMarkdownMode =
		typeof candidate.showMarkdownMode === "boolean"
			? candidate.showMarkdownMode
			: DEFAULT_EDITOR_PREFERENCES.showMarkdownMode;
	return {
		// A user who previously enabled only Raw JSON must land in a usable
		// editor after that mode is removed.
		showVisualMode: requestedVisualMode || !showMarkdownMode,
		showMarkdownMode,
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
