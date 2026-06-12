<!-- EditorToolbar.svelte — Formatting toolbar for TipTap editor -->
<script lang="ts">
import * as m from "$lib/paraglide/messages.js";
import type { Editor } from "@tiptap/core";
import {
	Bold,
	Code2,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
} from "lucide-svelte";
import LinkDialog from "./LinkDialog.svelte";

const {
	editor = null,
}: {
	editor?: Editor | null;
} = $props();

interface ToolbarAction {
	icon: typeof Bold;
	label: string;
	isActive: () => boolean;
	onClick: () => void;
}

// 8 preset highlight colors, keyed to the swatches shown in the popover.
const HIGHLIGHT_COLORS = [
	{ name: "Yellow", value: "#fde68a" },
	{ name: "Orange", value: "#fed7aa" },
	{ name: "Red", value: "#fecaca" },
	{ name: "Green", value: "#bbf7d0" },
	{ name: "Blue", value: "#bfdbfe" },
	{ name: "Purple", value: "#e9d5ff" },
	{ name: "Pink", value: "#fbcfe8" },
	{ name: "Gray", value: "#e5e7eb" },
] as const;

type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]["value"];

let linkDialogOpen = $state(false);
let highlightPickerOpen = $state(false);
let highlightPickerRoot = $state<HTMLDivElement | null>(null);

// Resolve the active highlight color from the current selection, if any.
const activeHighlightColor = $derived.by<HighlightColor | null>(() => {
	if (!editor) return null;
	if (!editor.isActive("highlight")) return null;
	const attrs = editor.getAttributes("highlight");
	const color = (attrs.color ?? "") as string;
	const match = HIGHLIGHT_COLORS.find((c) => c.value === color);
	return (match?.value as HighlightColor) ?? null;
});

const actions = $derived.by<ToolbarAction[]>(() => {
	if (!editor) return [];
	return [
		{
			icon: Bold,
			label: m.editor_toolbar_bold(),
			isActive: () => editor?.isActive("bold"),
			onClick: () => editor?.chain().focus().toggleBold().run(),
		},
		{
			icon: Italic,
			label: m.editor_toolbar_italic(),
			isActive: () => editor?.isActive("italic"),
			onClick: () => editor?.chain().focus().toggleItalic().run(),
		},
		{
			icon: Heading1,
			label: m.editor_toolbar_heading_1(),
			isActive: () => editor?.isActive("heading", { level: 1 }),
			onClick: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
		},
		{
			icon: Heading2,
			label: m.editor_toolbar_heading_2(),
			isActive: () => editor?.isActive("heading", { level: 2 }),
			onClick: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
		},
		{
			icon: Heading3,
			label: m.editor_toolbar_heading_3(),
			isActive: () => editor?.isActive("heading", { level: 3 }),
			onClick: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
		},
		{
			icon: List,
			label: m.editor_toolbar_bullet_list(),
			isActive: () => editor?.isActive("bulletList"),
			onClick: () => editor?.chain().focus().toggleBulletList().run(),
		},
		{
			icon: ListOrdered,
			label: m.editor_toolbar_ordered_list(),
			isActive: () => editor?.isActive("orderedList"),
			onClick: () => editor?.chain().focus().toggleOrderedList().run(),
		},
		{
			icon: Code2,
			label: m.editor_toolbar_code_block(),
			isActive: () => editor?.isActive("codeBlock"),
			onClick: () => editor?.chain().focus().toggleCodeBlock().run(),
		},
		{
			icon: LinkIcon,
			label: m.editor_toolbar_link(),
			isActive: () => editor?.isActive("link"),
			onClick: () => {
				linkDialogOpen = true;
			},
		},
	];
});

function isDisabled(): boolean {
	if (!editor) return true;
	return !editor.isEditable;
}

function toggleHighlightPicker() {
	highlightPickerOpen = !highlightPickerOpen;
}

function applyHighlight(color: HighlightColor) {
	if (!editor) return;
	editor.chain().focus().toggleHighlight({ color }).run();
	highlightPickerOpen = false;
}

function clearHighlight() {
	if (!editor) return;
	editor.chain().focus().unsetHighlight().run();
	highlightPickerOpen = false;
}

// Close the picker when clicking outside its root element.
$effect(() => {
	if (!highlightPickerOpen) return;
	function onDocPointer(e: PointerEvent) {
		const root = highlightPickerRoot;
		if (!root) return;
		const target = e.target as Node | null;
		if (target && !root.contains(target)) {
			highlightPickerOpen = false;
		}
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === "Escape") highlightPickerOpen = false;
	}
	document.addEventListener("pointerdown", onDocPointer);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("pointerdown", onDocPointer);
		document.removeEventListener("keydown", onKey);
	};
});
</script>

{#if editor}
	<div class="toolbar" role="toolbar" aria-label={m.editor_toolbar_text_formatting()}>
		{#each actions as action, i}
			{#if i === 2 || i === 5 || i === 7 || i === 8}
				<div class="toolbar-divider" aria-hidden="true"></div>
			{/if}
			<button
				class="toolbar-btn"
				class:active={action.isActive()}
				disabled={isDisabled()}
				onclick={action.onClick}
				title={action.label}
				aria-label={action.label}
				aria-pressed={action.isActive()}
				type="button"
			>
				<action.icon size={16} />
			</button>
		{/each}

		<div class="toolbar-divider" aria-hidden="true"></div>

		<div class="highlight-picker" bind:this={highlightPickerRoot}>
			<button
				class="toolbar-btn highlight-btn"
				class:active={editor?.isActive("highlight")}
				disabled={isDisabled()}
				onclick={toggleHighlightPicker}
				title={m.editor_toolbar_highlight()}
				aria-label={m.editor_toolbar_highlight()}
				aria-pressed={editor?.isActive("highlight")}
				aria-haspopup="true"
				aria-expanded={highlightPickerOpen}
				type="button"
			>
				<Highlighter size={16} />
				<span
					class="highlight-dot"
					class:visible={activeHighlightColor !== null}
					style:background-color={activeHighlightColor ?? "transparent"}
					aria-hidden="true"
				></span>
			</button>

			{#if highlightPickerOpen}
				<div class="highlight-popover" role="menu" aria-label={m.editor_toolbar_highlight()}>
					<div class="highlight-swatch-grid">
						{#each HIGHLIGHT_COLORS as color (color.value)}
							<button
								type="button"
								class="highlight-swatch"
								class:selected={activeHighlightColor === color.value}
								style:background-color={color.value}
								title={color.name}
								aria-label={color.name}
								role="menuitem"
								onclick={() => applyHighlight(color.value)}
							></button>
						{/each}
					</div>
					{#if activeHighlightColor !== null}
						<button
							type="button"
							class="highlight-clear"
							role="menuitem"
							onclick={clearHighlight}
						>
							{m.action_cancel()}
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<LinkDialog bind:open={linkDialogOpen} {editor} />
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--border);
		background: var(--card);
		flex-wrap: wrap;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.toolbar-divider {
		width: 1px;
		height: 20px;
		background: var(--border);
		margin: 0 4px;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--muted-foreground);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--accent-foreground);
	}

	.toolbar-btn.active {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	.toolbar-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Highlight popover trigger button + indicator */
	.highlight-picker {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.highlight-btn {
		position: relative;
	}

	.highlight-dot {
		position: absolute;
		bottom: 6px;
		right: 6px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1px solid var(--border);
		opacity: 0;
		transform: scale(0.6);
		transition: opacity 0.15s ease, transform 0.15s ease;
		pointer-events: none;
	}

	.highlight-dot.visible {
		opacity: 1;
		transform: scale(1);
	}

	/* Popover panel */
	.highlight-popover {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		background: var(--popover);
		color: var(--popover-foreground);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 180px;
	}

	.highlight-swatch-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}

	.highlight-swatch {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 1px solid var(--border);
		cursor: pointer;
		padding: 0;
		transition: transform 0.1s ease, box-shadow 0.1s ease;
	}

	.highlight-swatch:hover {
		transform: scale(1.08);
		box-shadow: 0 0 0 2px var(--ring);
	}

	.highlight-swatch.selected {
		box-shadow: 0 0 0 2px var(--ring);
	}

	.highlight-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px 8px;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
	}

	.highlight-clear:hover {
		background: var(--accent);
		color: var(--accent-foreground);
	}
</style>
