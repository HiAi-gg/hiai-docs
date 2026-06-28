// keyboard.svelte.ts — Global keyboard shortcut registry and reactive UI
// state for the Quick Search palette and Shortcut Help modal.
//
// The registry is module-scoped so any component (editor, sidebar, command
// palette, list pages, dialogs) can register a handler by id, and a single
// `handleKeyEvent` listener on `window` dispatches the matching shortcut.
//
// Scopes keep shortcuts from colliding:
//   - "global"   — always active (e.g. Cmd+K to open Quick Search)
//   - "editor"   — only when the TipTap editor is focused
//   - "dialog"   — only while a modal/dialog is open
//   - "list"     — only on list pages (RecentDocs, FolderTree, Tags list)
//
// Inputs and textareas are skipped by default so typing letters in a
// `<textarea>` doesn't trigger shortcuts like `?` to open help. A shortcut
// can opt-in to firing inside inputs via `overrideInput: true`.

export type ShortcutScope = "global" | "editor" | "dialog" | "list";

export interface Shortcut {
	/** Stable identifier used by register/unregister and help rendering. */
	id: string;
	/**
	 * Normalised key combination. Stored as a sorted, lowercased string of
	 * modifier+key tokens joined by `+`, e.g. "mod+k", "shift+?", "escape".
	 * We accept the loose `keys` form here and normalise at registration time.
	 */
	keys: string;
	/** Handler invoked when the shortcut fires. */
	handler: (e: KeyboardEvent) => void;
	/** Where the shortcut is allowed to fire. Defaults to "global". */
	scope?: ShortcutScope;
	/** Human-readable description shown in the Shortcut Help modal. */
	description: string;
	/** Whether the shortcut is currently active. Defaults to true. */
	enabled?: boolean;
	/**
	 * When true the shortcut fires even if the event target is an
	 * `<input>`, `<textarea>`, or `[contenteditable]`. Use sparingly.
	 */
	overrideInput?: boolean;
}

// --- Module-level reactive state ---------------------------------------------

let isQuickSearchOpen = $state(false);
let isShortcutHelpOpen = $state(false);

// We keep the registry as a Map for O(1) lookup by id and so the same
// shortcut id can be re-registered (e.g. by an editor that mounts later
// and wants to own a global shortcut). Using $state on a Map means reads
// via `keyboardRegistry.get(id)` inside an `$effect` will react to changes.
const keyboardRegistry = $state(new Map<string, Shortcut>());

// --- Helpers -----------------------------------------------------------------

const MODIFIER_ORDER = ["mod", "ctrl", "alt", "shift", "meta"] as const;

/**
 * Normalise a key combination into the canonical form used in the registry.
 * Accepts forms like "Cmd+K", "ctrl+k", "shift+Slash", "?" and produces
 * "mod+k", "ctrl+k", "shift+/", "shift+?".
 *
 * - "mod" is the cross-platform "primary modifier" (Meta on macOS, Ctrl
 *   elsewhere) — we map both `cmd` and `mod` to `mod` here.
 * - Key names are lowercased and a handful of synonyms are expanded
 *   (Esc → escape, Slash → /, Question → ?).
 */
export function normaliseKeys(keys: string): string {
	const tokens = keys
		.split("+")
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean)
		.map((t) => {
			if (t === "cmd" || t === "meta") return "mod";
			if (t === "esc") return "escape";
			if (t === "slash") return "/";
			if (t === "question") return "?";
			return t;
		});

	const mods: string[] = [];
	let key = "";
	for (const token of tokens) {
		if ((MODIFIER_ORDER as readonly string[]).includes(token)) {
			if (!mods.includes(token)) mods.push(token);
		} else {
			// Last non-modifier wins; this lets "Shift+?" and "Shift+Slash"
			// both resolve to "shift+?".
			key = token;
		}
	}
	mods.sort(
		(a, b) =>
			MODIFIER_ORDER.indexOf(a as (typeof MODIFIER_ORDER)[number]) -
			MODIFIER_ORDER.indexOf(b as (typeof MODIFIER_ORDER)[number]),
	);
	return [...mods, key].filter(Boolean).join("+");
}

/** True when the event target is a text-entry element we should ignore. */
function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return false;
}

/** True when the given KeyboardEvent matches the normalised key combo. */
function eventMatches(event: KeyboardEvent, normalised: string): boolean {
	const parts = normalised.split("+");
	if (parts.length === 0) return false;

	const key = parts[parts.length - 1];
	if (!key) return false;

	// Modifier key (e.g. "shift" alone) shouldn't fire on key up of Shift.
	if (["shift", "ctrl", "alt", "meta", "mod"].includes(key)) return false;

	const wantMod = parts.includes("mod");
	const wantCtrl = parts.includes("ctrl");
	const wantAlt = parts.includes("alt");
	const wantShift = parts.includes("shift");
	const wantMeta = parts.includes("meta");

	// `mod` is satisfied by either ctrl or meta so the same combo works
	// across macOS (Cmd) and Linux/Windows (Ctrl).
	const modOk = wantMod
		? event.ctrlKey || event.metaKey
		: !event.ctrlKey && !event.metaKey;
	const ctrlOk = wantCtrl === event.ctrlKey;
	const altOk = wantAlt === event.altKey;
	const shiftOk = wantShift === event.shiftKey;
	const metaOk = wantMeta === event.metaKey;

	if (!(modOk && ctrlOk && altOk && shiftOk && metaOk)) return false;

	const eventKey = event.key.toLowerCase();
	return eventKey === key;
}

// --- Registry API ------------------------------------------------------------

export function registerShortcut(shortcut: Shortcut): void {
	if (!shortcut.id) return;
	const normalised: Shortcut = {
		...shortcut,
		keys: normaliseKeys(shortcut.keys),
		scope: shortcut.scope ?? "global",
		enabled: shortcut.enabled ?? true,
	};
	keyboardRegistry.set(shortcut.id, normalised);
}

export function unregisterShortcut(id: string): void {
	keyboardRegistry.delete(id);
}

export function getShortcut(id: string): Shortcut | undefined {
	return keyboardRegistry.get(id);
}

export function getShortcutsByScope(scope: ShortcutScope): Shortcut[] {
	const result: Shortcut[] = [];
	for (const shortcut of keyboardRegistry.values()) {
		if ((shortcut.scope ?? "global") === scope) result.push(shortcut);
	}
	return result;
}

export function clearShortcuts(): void {
	keyboardRegistry.clear();
}

// --- Quick Search / Shortcut Help state --------------------------------------

export function toggleQuickSearch(): void {
	isQuickSearchOpen = !isQuickSearchOpen;
}

export function setQuickSearchOpen(open: boolean): void {
	isQuickSearchOpen = open;
}

export function toggleShortcutHelp(): void {
	isShortcutHelpOpen = !isShortcutHelpOpen;
}

export function setShortcutHelpOpen(open: boolean): void {
	isShortcutHelpOpen = open;
}

// --- Default shortcut registrations ------------------------------------------
//
// These are the always-on shortcuts. Editor and dialog-scoped shortcuts
// are registered by the components that own them so they get torn down
// with the component lifecycle.

let defaultsRegistered = false;

export function registerDefaultShortcuts(): void {
	if (defaultsRegistered) return;
	defaultsRegistered = true;

	registerShortcut({
		id: "quick-search",
		keys: "mod+k",
		description: "Open quick search",
		scope: "global",
		handler: () => toggleQuickSearch(),
		overrideInput: true,
	});

	registerShortcut({
		id: "shortcut-help",
		keys: "shift+?",
		description: "Show keyboard shortcuts",
		scope: "global",
		// Skip when typing in inputs/textareas/contenteditable so pressing
		// `?` while writing prose doesn't open the help dialog.
		handler: () => toggleShortcutHelp(),
		overrideInput: false,
	});

	registerShortcut({
		id: "escape-close",
		keys: "escape",
		description: "Close dialog or panel",
		scope: "global",
		// Escape always fires — dialogs rely on it even when the focus is
		// inside an input the user is editing.
		handler: () => {
			if (isQuickSearchOpen) {
				setQuickSearchOpen(false);
			} else if (isShortcutHelpOpen) {
				setShortcutHelpOpen(false);
			}
		},
		overrideInput: true,
	});
}

// --- Event dispatcher --------------------------------------------------------

/**
 * Match a KeyboardEvent against the registry and invoke the first matching
 * enabled handler. Returns `true` if a handler fired (so callers can
 * `preventDefault()` if they want to stop further propagation).
 */
export function handleKeyEvent(event: KeyboardEvent): boolean {
	const inEditable = isEditableTarget(event.target);

	for (const shortcut of keyboardRegistry.values()) {
		if (shortcut.enabled === false) continue;
		if (inEditable && !shortcut.overrideInput) continue;
		if (!eventMatches(event, shortcut.keys)) continue;
		try {
			shortcut.handler(event);
		} catch (err) {
			// Swallow handler errors so one bad shortcut doesn't break the
			// dispatcher. Errors are surfaced through the global console so
			// developers can still spot them in dev.
			console.error(`[keyboard] handler for "${shortcut.id}" threw`, err);
		}
		return true;
	}
	return false;
}

// --- Public reactive getters -------------------------------------------------

export function getIsQuickSearchOpen(): boolean {
	return isQuickSearchOpen;
}

export function getIsShortcutHelpOpen(): boolean {
	return isShortcutHelpOpen;
}

export const keyboardStore = {
	get isQuickSearchOpen(): boolean {
		return isQuickSearchOpen;
	},
	get isShortcutHelpOpen(): boolean {
		return isShortcutHelpOpen;
	},
	toggleQuickSearch,
	setQuickSearchOpen,
	toggleShortcutHelp,
	setShortcutHelpOpen,
	register: registerShortcut,
	unregister: unregisterShortcut,
	getShortcutsByScope,
	handleKeyEvent,
};
