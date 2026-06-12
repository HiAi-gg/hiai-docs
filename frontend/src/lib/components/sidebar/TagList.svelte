<script lang="ts">
import { type Tag, listTags } from "$lib/api/tags";
import TagCreateDialog from "$lib/components/TagCreateDialog.svelte";
import * as m from "$lib/paraglide/messages.js";
import { cn } from "$lib/utils";
import { Plus } from "lucide-svelte";
import { onMount } from "svelte";

let tags = $state<Tag[]>([]);
let activeId = $state<string | null>(null);
let loadError = $state<string | null>(null);
let showCreateDialog = $state(false);

async function refresh() {
	try {
		tags = await listTags();
	} catch (e) {
		console.error("TagList: failed to load tags", e);
		loadError = "Failed to load tags";
	}
}

onMount(() => {
	void refresh();
});

function handleCreated(_tag: Tag) {
	void refresh();
}
</script>

<div class="space-y-1">
  <h3 class="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.doc_tags()}</h3>
  {#if loadError}
    <p class="px-2 text-xs text-destructive">{loadError}</p>
  {/if}
  <div class="flex flex-wrap gap-1 px-2">
    {#each tags as tag (tag.id)}
      <button
        onclick={() => { activeId = activeId === tag.id ? null : tag.id; }}
        class={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
          activeId === tag.id
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )}
      >
        <span class={cn("size-2 rounded-full", tag.color)}></span>
        {tag.name}
      </button>
    {/each}
    <button
      type="button"
      onclick={() => { showCreateDialog = true; }}
      class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
      aria-label={m.tags_new()}
    >
      <Plus class="size-3" />
      {m.tags_add()}
    </button>
  </div>
</div>

<TagCreateDialog bind:open={showCreateDialog} onCreated={handleCreated} />
