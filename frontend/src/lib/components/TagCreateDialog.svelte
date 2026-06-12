<script lang="ts">
import { type Tag, createTag, createTagInputSchema } from "$lib/api/tags";
import { Button } from "$lib/components/ui/button";
import {
	Dialog,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";
import { Label } from "$lib/components/ui/label";
import * as m from "$lib/paraglide/messages.js";

let {
	open = $bindable(false),
	onCreated,
}: {
	open?: boolean;
	onCreated?: (tag: Tag) => void;
} = $props();

let name = $state("");
let nameError = $state<string | null>(null);
let submitError = $state<string | null>(null);
let submitting = $state(false);

function reset() {
	name = "";
	nameError = null;
	submitError = null;
	submitting = false;
}

function close() {
	open = false;
	reset();
}

function handleOpenChange(next: boolean) {
	if (!next) reset();
	open = next;
}

function handleSubmit(e: Event) {
	e.preventDefault();
	nameError = null;
	submitError = null;

	const parsed = createTagInputSchema.safeParse({ name });
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		nameError = issue?.message ?? "Invalid input";
		return;
	}

	void doCreate(parsed.data.name);
}

async function doCreate(trimmed: string) {
	submitting = true;
	try {
		const created = await createTag(trimmed);
		onCreated?.(created);
		close();
	} catch (e) {
		submitError = e instanceof Error ? e.message : m.error_generic();
		console.error("TagCreateDialog: createTag failed", e);
	} finally {
		submitting = false;
	}
}

function handleInputKeydown(e: KeyboardEvent) {
	if (e.key === "Enter" && !submitting) {
		e.preventDefault();
		handleSubmit(new Event("submit"));
	}
}
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
  <DialogHeader>
    <DialogTitle>{m.tags_new()}</DialogTitle>
    <DialogDescription>{m.tags_name_placeholder()}</DialogDescription>
  </DialogHeader>

  <form onsubmit={handleSubmit} class="space-y-4">
    <div class="space-y-2">
      <Label for="tag-name">{m.tags_name_placeholder()}</Label>
      <Input
        id="tag-name"
        name="name"
        type="text"
        bind:value={name}
        placeholder={m.tags_name_placeholder()}
        maxlength={50}
        required
        disabled={submitting}
        aria-invalid={nameError ? "true" : undefined}
        aria-describedby={nameError ? "tag-name-error" : undefined}
        autocomplete="off"
        onkeydown={handleInputKeydown}
      />
      {#if nameError}
        <p id="tag-name-error" class="text-xs text-destructive">{nameError}</p>
      {/if}
    </div>

    {#if submitError}
      <p class="text-xs text-destructive" role="alert">{submitError}</p>
    {/if}
  </form>

  <DialogFooter>
    <Button variant="outline" type="button" onclick={close} disabled={submitting}>
      {m.action_cancel()}
    </Button>
    <Button
      type="submit"
      onclick={handleSubmit}
      disabled={submitting || name.trim().length === 0}
    >
      {submitting ? m.action_loading() : m.action_create()}
    </Button>
  </DialogFooter>
</Dialog>
