<script lang="ts">
import type { CollaborationSession } from "$lib/collaboration";
import * as m from "$lib/paraglide/messages.js";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { onDestroy, onMount } from "svelte";
import { EditorContent, createEditor } from "svelte-tiptap";
import type { Editor } from "svelte-tiptap";
import EditorToolbar from "./EditorToolbar.svelte";

const {
	content = "",
	placeholder = m.doc_content_placeholder(),
	onUpdate = (_md: string) => {},
	editable = true,
	collaboration = null,
}: {
	content?: string;
	placeholder?: string;
	onUpdate?: (markdown: string) => void;
	editable?: boolean;
	collaboration?: CollaborationSession | null;
} = $props();

const lowlight = createLowlight(common);

let editorStore: ReturnType<typeof createEditor> | null = null;
let editor = $state<Editor | null>(null);
let ready = $state(false);
let suppressNextUpdate = false;

onMount(() => {
	const extensions = [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			codeBlock: false,
			link: false,
		}),
		Markdown.configure({}),
		Link.configure({
			openOnClick: false,
			HTMLAttributes: { class: "doc-link" },
		}),
		Highlight.configure({ multicolor: true }),
		CodeBlockLowlight.configure({ lowlight }),
	];

	if (collaboration?.doc) {
		extensions.push(
			Collaboration.configure({
				document: collaboration.doc,
			}) as unknown as (typeof extensions)[number],
			CollaborationCursor.configure({
				provider: collaboration.provider,
				user: {
					name: "Anonymous",
					color: `#${Math.floor(Math.random() * 16777215)
						.toString(16)
						.padStart(6, "0")}`,
				},
			}) as unknown as (typeof extensions)[number],
		);
	}

	editorStore = createEditor({
		extensions,
		content: collaboration?.doc ? undefined : content,
		editable,
		editorProps: {
			attributes: {
				"aria-label": m.editor_content_label(),
				"aria-multiline": "true",
				role: "textbox",
				class: "tiptap-editor",
			},
		},
		onUpdate: ({ editor: ed }) => {
			if (suppressNextUpdate) {
				suppressNextUpdate = false;
				return;
			}
			if (!collaboration) {
				const mdExtension = ed.storage.markdown as
					| { getMarkdown?: () => string }
					| undefined;
				const md = mdExtension?.getMarkdown?.() ?? ed.getText();
				onUpdate(md);
			}
		},
	});

	const unsubscribe = editorStore.subscribe((ed) => {
		editor = ed;
		if (ed && !ready) {
			ready = true;
		}
	});

	return () => unsubscribe();
});

let prevContent = $state("");
$effect(() => {
	if (!editor || collaboration?.doc) return;
	if (content !== prevContent) {
		prevContent = content;
		suppressNextUpdate = true;
		editor.commands.setContent(content, { emitUpdate: false });
	}
});

onDestroy(() => {
	editor?.destroy?.();
});
</script>

<div class="tipex-wrapper">
  {#if ready && editor}
    <EditorToolbar {editor} />
    <div class="editor-content">
      <EditorContent {editor} />
    </div>
  {:else}
    <div class="editor-skeleton">
      <div class="skeleton-toolbar">
        {#each Array(10) as _}
          <div class="skeleton-icon"></div>
        {/each}
      </div>
      <div class="skeleton-body">
        <div class="skeleton-bar" style="width: 60%"></div>
        <div class="skeleton-bar" style="width: 90%"></div>
        <div class="skeleton-bar" style="width: 75%"></div>
        <div class="skeleton-bar" style="width: 85%"></div>
        <div class="skeleton-bar" style="width: 40%"></div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tipex-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .editor-content {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .editor-content :global(.tiptap) {
    outline: none;
    min-height: 300px;
    font-size: 16px;
    line-height: 1.7;
    color: var(--foreground);
  }

  .editor-content :global(.tiptap:focus-visible) {
    outline: none;
  }

  .editor-content :global(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: var(--muted-foreground);
    pointer-events: none;
    height: 0;
  }

  .editor-content :global(.tiptap h1) {
    font-size: 2rem;
    font-weight: 800;
    margin: 1.5rem 0 0.75rem;
    letter-spacing: -0.025em;
  }

  .editor-content :global(.tiptap h2) {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 1.25rem 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .editor-content :global(.tiptap h3) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  .editor-content :global(.tiptap p) {
    margin: 0.5rem 0;
  }

  .editor-content :global(.tiptap ul),
  .editor-content :global(.tiptap ol) {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }

  .editor-content :global(.tiptap li) {
    margin: 0.25rem 0;
  }

  .editor-content :global(.tiptap blockquote) {
    border-left: 3px solid var(--border);
    padding-left: 1rem;
    margin: 0.75rem 0;
    color: var(--muted-foreground);
    font-style: italic;
  }

  .editor-content :global(.tiptap code) {
    background: var(--muted);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: "Fira Code", "Consolas", monospace;
  }

  .editor-content :global(.tiptap pre) {
    background: oklch(0.145 0.013 285.82);
    color: oklch(0.985 0.002 247.86);
    padding: 1rem;
    border-radius: 8px;
    font-family: "Fira Code", "Consolas", monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    overflow-x: auto;
    margin: 0.75rem 0;
  }

  .editor-content :global(.tiptap pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
    color: inherit;
  }

  /* lowlight syntax highlighting */
  .editor-content :global(.tiptap pre .hljs-keyword) {
    color: #c792ea;
  }
  .editor-content :global(.tiptap pre .hljs-string) {
    color: #c3e88d;
  }
  .editor-content :global(.tiptap pre .hljs-number) {
    color: #f78c6c;
  }
  .editor-content :global(.tiptap pre .hljs-function) {
    color: #82aaff;
  }
  .editor-content :global(.tiptap pre .hljs-title) {
    color: #82aaff;
  }
  .editor-content :global(.tiptap pre .hljs-comment) {
    color: #676e95;
    font-style: italic;
  }
  .editor-content :global(.tiptap pre .hljs-built_in) {
    color: #ffcb6b;
  }
  .editor-content :global(.tiptap pre .hljs-type) {
    color: #ffcb6b;
  }
  .editor-content :global(.tiptap pre .hljs-attr) {
    color: #ffcb6b;
  }
  .editor-content :global(.tiptap pre .hljs-variable) {
    color: #f07178;
  }
  .editor-content :global(.tiptap pre .hljs-literal) {
    color: #ff5370;
  }

  .editor-content :global(.tiptap hr) {
    border: none;
    border-top: 2px solid var(--border);
    margin: 1.5rem 0;
  }

  .editor-content :global(.tiptap .doc-link) {
    color: var(--primary);
    text-decoration: underline;
    cursor: pointer;
  }

  .editor-content :global(.tiptap mark) {
    /* Inline `style="background-color: ..."` set by TipTap (multicolor mode)
       wins via specificity; this is the fallback for marks without a color. */
    background-color: var(--highlight-default, #fde68a);
    border-radius: 2px;
    padding: 0 2px;
  }

  /* Skeleton loading state */
  .editor-skeleton {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .skeleton-toolbar {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .skeleton-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
  }

  .skeleton-bar {
    height: 16px;
    border-radius: 4px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
