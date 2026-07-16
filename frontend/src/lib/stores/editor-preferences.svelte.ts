import {
	DEFAULT_EDITOR_PREFERENCES,
	type EditorPreferences,
	normalizeEditorPreferences,
} from "./editor-preferences";

const STORAGE_KEY = "docsmint-editor-preferences";

let preferences = $state<EditorPreferences>({ ...DEFAULT_EDITOR_PREFERENCES });
let initialized = false;

function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function init() {
	if (!isBrowser() || initialized) return;
	initialized = true;
	try {
		preferences = normalizeEditorPreferences(
			JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"),
		);
	} catch {
		preferences = { ...DEFAULT_EDITOR_PREFERENCES };
	}
}

function update(patch: Partial<EditorPreferences>) {
	preferences = normalizeEditorPreferences({ ...preferences, ...patch });
	if (isBrowser()) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
	}
}

export const editorPreferences = {
	get value(): EditorPreferences {
		return preferences;
	},
	get showMarkdownMode(): boolean {
		return preferences.showMarkdownMode;
	},
	get showVisualMode(): boolean {
		return preferences.showVisualMode;
	},
	get minimalToolbar(): boolean {
		return preferences.minimalToolbar;
	},
	get showScrollToTop(): boolean {
		return preferences.showScrollToTop;
	},
	init,
	update,
};
