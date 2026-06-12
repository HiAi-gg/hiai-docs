<!-- LinkDialog.svelte — Modal dialog to set/edit a link on the active Tiptap selection -->
<script lang="ts">
import { Button } from "$lib/components/ui/button";
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";
import * as m from "$lib/paraglide/messages.js";
import type { Editor } from "@tiptap/core";

let {
	open = $bindable(false),
	editor = null,
}: {
	open?: boolean;
	editor?: Editor | null;
} = $props();

let url = $state("");
let inputEl = $state<HTMLInputElement | null>(null);

// Reset the input field with the existing link href (if any) whenever
// the dialog opens. Using $effect to react to `open` changes.
$effect(() => {
	if (open && editor) {
		const previousUrl = editor.getAttributes("link").href ?? "";
		url = previousUrl;
		// Defer focus to next tick so the input is mounted.
		queueMicrotask(() => inputEl?.focus());
	}
});

function close() {
	open = false;
}

function handleCancel() {
	close();
}

function handleApply() {
	if (!editor) {
		close();
		return;
	}
	const trimmed = url.trim();
	if (trimmed === "") {
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
	} else {
		editor
			.chain()
			.focus()
			.extendMarkRange("link")
			.setLink({ href: trimmed })
			.run();
	}
	close();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		handleApply();
	}
}
</script>

<Dialog bind:open>
	<DialogHeader>
		<DialogTitle>{m.editor_toolbar_link()}</DialogTitle>
	</DialogHeader>
	<div class="link-dialog-body">
		<label for="link-url" class="link-dialog-label">
			{m.editor_enter_url()}
		</label>
		<Input
			id="link-url"
			bind:ref={inputEl}
			bind:value={url}
			type="url"
			placeholder="https://example.com"
			onkeydown={handleKeydown}
		/>
	</div>
	<DialogFooter>
		<Button variant="outline" type="button" onclick={handleCancel}>
			{m.action_cancel()}
		</Button>
		<Button type="button" onclick={handleApply}>
			{m.action_save()}
		</Button>
	</DialogFooter>
</Dialog>

<style>
	.link-dialog-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 0 1rem 0;
	}

	.link-dialog-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
	}
</style>
