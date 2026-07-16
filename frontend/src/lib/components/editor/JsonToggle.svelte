<script lang="ts">
import { Check, Copy } from "lucide-svelte";
import type { EditorOutput } from "./HiAiEditor.svelte";
import { serializeMarkdownExport } from "./markdown-export";

const {
	documentId,
	contentJson,
	onUpdate = (_output: EditorOutput) => {},
}: {
	documentId: string;
	contentJson?: object;
	onUpdate?: (output: EditorOutput) => void;
} = $props();

let raw = $state("");
let error = $state("");
let copied = $state(false);
let loadedDocumentId: string | null = null;
let rawEditor = $state<HTMLDivElement | null>(null);
let textarea = $state<HTMLTextAreaElement | null>(null);
let initialEditorHeight = 0;

function resizeTextarea() {
	if (!textarea) return;
	if (initialEditorHeight === 0) {
		const containerHeight =
			textarea.closest<HTMLElement>(".editor-container")?.clientHeight ?? 0;
		initialEditorHeight = Math.max(
			rawEditor?.clientHeight ?? 0,
			containerHeight,
		);
	}
	textarea.style.minHeight = `${initialEditorHeight}px`;
	textarea.style.height = "auto";
	textarea.style.height = `${Math.max(initialEditorHeight, textarea.scrollHeight)}px`;
}

$effect(() => {
	const nextDocumentId = documentId;
	const nextContentJson = contentJson;
	if (loadedDocumentId === nextDocumentId) return;
	loadedDocumentId = nextDocumentId;
	raw = JSON.stringify(
		nextContentJson ?? { type: "doc", content: [{ type: "paragraph" }] },
		null,
		2,
	);
	error = "";
	if (typeof window !== "undefined") queueMicrotask(resizeTextarea);
});

function handleInput(event: Event) {
	raw = (event.currentTarget as HTMLTextAreaElement).value;
	resizeTextarea();
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("The document root must be a JSON object.");
		}
		const json = parsed as object;
		const markdown = serializeMarkdownExport(json, "");
		error = "";
		onUpdate({ markdown, json });
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "Invalid JSON";
	}
}

async function copySource() {
	await navigator.clipboard.writeText(raw);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}
</script>

<div class="json-toggle" bind:this={rawEditor}>
	<button type="button" class="copy-btn" onclick={copySource} aria-label="Copy JSON source">
		{#if copied}<Check size={14} /> Copied!{:else}<Copy size={14} /> Copy JSON{/if}
	</button>
	<textarea
		bind:this={textarea}
		value={raw}
		oninput={handleInput}
		class:invalid={Boolean(error)}
		spellcheck="false"
		aria-label="Raw JSON editor"
		aria-invalid={Boolean(error)}
	></textarea>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
	.json-toggle {
		position: relative; display: flex; flex: 1; flex-direction: column;
		width: 100%; min-height: 0;
	}
	textarea {
		display: block; flex: none; width: 100%; height: 100%; min-height: 0;
		padding: 56px 24px 24px;
		box-sizing: border-box; resize: vertical; overflow-y: hidden;
		border: 0; border-radius: 8px; outline: none; background: var(--muted);
		color: var(--foreground); font: 13px/1.65 'Fira Code', Consolas, monospace;
	}
	textarea:focus { background: var(--background); box-shadow: inset 0 0 0 1px var(--ring); }
	textarea.invalid { box-shadow: inset 0 0 0 1px var(--destructive); }
	.copy-btn {
		position: absolute; top: 12px; right: 24px; z-index: 2; display: inline-flex;
		align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border);
		border-radius: 6px; background: var(--card); color: var(--muted-foreground);
		font-size: 12px; cursor: pointer;
	}
	.error { flex: none; margin: 8px 4px 0; color: var(--destructive); font-size: 12px; }
</style>
