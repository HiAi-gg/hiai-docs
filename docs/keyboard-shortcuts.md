# Keyboard Shortcuts

> Status: **stable** (added in the 5-features rollout)
> Registry: `frontend/src/lib/stores/keyboard.svelte.ts`
> Help overlay: press `?` anywhere or use the global `Open shortcuts`
> command inside QuickSearch.

Cross-platform modifier syntax:

- `mod` is automatically rendered as `⌘` on macOS and `Ctrl` everywhere
  else — the actual key binding is platform-correct without code
  changes.
- `shift` is `⇧` (or `Shift` on non-mac). When paired with a printable
  character, the help overlay shows `⇧?` for `shift+?`, `⇧K` for
  `shift+k`, etc.

## Global

These shortcuts fire from anywhere in the app unless an input/textarea
has focus and the binding has `overrideInput: false`.

| Shortcut | Action | Description |
| -------- | ------ | ----------- |
| `mod+K` | Open QuickSearch | Command palette: jump to documents, run app commands. Fires from inside inputs. |
| `?` (Shift+/) | Open ShortcutHelp | This overlay. Always visible in the top-right of the overlay. |
| `Esc` | Close overlay | Closes QuickSearch, ShortcutHelp, or any open modal. Fires from inside inputs. |

## Editor

Scoped to the document editor route (`/docs/:id`). Bindings are
registered on mount and unregistered on cleanup by `HiAiEditor.svelte`.

| Shortcut | Action | Description |
| -------- | ------ | ----------- |
| `mod+B` | Bold | Built-in TipTap binding. |
| `mod+I` | Italic | Built-in TipTap binding. |
| `mod+U` | Underline | Built-in TipTap binding. |
| `mod+Z` / `mod+Shift+Z` | Undo / Redo | Built-in TipTap bindings. |
| `mod+Shift+7` | Toggle WYSIWYG / Markdown | Switches the editor between the TipTap view and the raw Markdown source. Dispatches a `hiai:toggle-markdown` CustomEvent that the page-level effect listens for. |
| `mod+Shift+E` | Export document | Downloads the current document as a `.md` file. Dispatches `hiai:export-document`. |

## Dialog

Registered only while a dialog component is open.

| Shortcut | Action | Description |
| -------- | ------ | ----------- |
| `Esc` | Close dialog | Closes any open modal. The shadcn-svelte `Dialog` primitive handles this internally; only `ShareDialog` (a manual modal) needs the explicit registration. |

## List

Reserved for shortcuts that operate on list-style pages (folder view,
search results, dashboard). No bindings ship yet — extend the registry
when adding new list interactions.

## Conventions for contributors

When adding a new shortcut:

1. Pick an existing scope (`global`, `editor`, `dialog`, `list`) or add
   a new one in `getShortcutsByScope` + `ShortcutHelp.svelte`.
2. Use the `mod` modifier, not literal `cmd`/`ctrl`.
3. Set `overrideInput` explicitly. Use `true` when the shortcut must
   fire from inside an input/textarea (QuickSearch, dialog close); use
   `false` for shortcuts that should only fire outside text fields.
4. Register on mount and unregister on cleanup. Pair `registerShortcut`
   with an `unregisterShortcut` in the component's `$effect` cleanup.
5. Don't shadow browser or OS defaults. Reserve `Cmd+1..9` for the
   browser's tab-switching; prefer `Cmd+Shift+Digit` for app-level jumps.
6. Add a matching `m.shortcut_help_*` message in
   `frontend/messages/en.json` so the `?` overlay stays in sync with
   the source of truth.
7. Document the new shortcut in this file (the overlay reads from the
   registry; the README links here for canonical reference).

See `CONTRIBUTING.md` for the contributor checklist and
`frontend/src/lib/stores/keyboard.svelte.ts` for the registry API.
