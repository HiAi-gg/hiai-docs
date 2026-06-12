<script lang="ts">
import { goto } from "$app/navigation";
import SearchBar from "$lib/components/SearchBar.svelte";
import * as m from "$lib/paraglide/messages.js";
import { cn } from "$lib/utils";
import {
	Clock,
	Folder,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
	Tag,
} from "lucide-svelte";
import FolderTree from "./FolderTree.svelte";
import RecentDocs from "./RecentDocs.svelte";
import TagList from "./TagList.svelte";

let collapsed = $state(false);
type PanelMode = "all" | "recent" | "tags";
let activePanel = $state<PanelMode>("all");

function openSearch() {
	goto("/search");
}

function togglePanel(mode: PanelMode) {
	activePanel = activePanel === mode ? "all" : mode;
	collapsed = false;
}

function toggleCollapse() {
	collapsed = !collapsed;
	if (collapsed) {
		activePanel = "all";
	}
}
</script>

<aside class={cn(
  "relative flex h-screen flex-col border-r border-border bg-card transition-[width] duration-200",
  collapsed ? "w-12" : "w-64"
)}>
  <!-- Toggle -->
  <button
    onclick={toggleCollapse}
    class="absolute -right-3 top-4 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent"
  >
    {#if collapsed}
      <PanelLeftOpen class="size-3.5" />
    {:else}
      <PanelLeftClose class="size-3.5" />
    {/if}
  </button>

  {#if !collapsed}
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
      <!-- Search -->
      <SearchBar />

      {#if activePanel === "all"}
        <!-- Folders -->
        <FolderTree />

        <!-- Separator -->
        <div class="h-px bg-border"></div>
      {/if}

      {#if activePanel === "all" || activePanel === "recent"}
        <!-- Recent Docs -->
        <RecentDocs />

        <!-- Separator -->
        <div class="h-px bg-border"></div>
      {/if}

      {#if activePanel === "all" || activePanel === "tags"}
        <!-- Tags -->
        <TagList />
      {/if}
    </div>
  {:else}
    <div class="flex flex-1 flex-col items-center gap-1 pt-14">
      <span class="flex size-8 items-center justify-center rounded-md text-muted-foreground" title={m.sidebar_folders()}>
        <Folder class="size-4" />
      </span>
      <button
        onclick={openSearch}
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        title={m.search_title()}
        aria-label={m.search_title()}
      >
        <Search class="size-4" />
      </button>
      <button
        onclick={() => togglePanel("recent")}
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        title={m.sidebar_recent()}
        aria-label={m.sidebar_recent()}
      >
        <Clock class="size-4" />
      </button>
      <button
        onclick={() => togglePanel("tags")}
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        title={m.doc_tags()}
        aria-label={m.doc_tags()}
      >
        <Tag class="size-4" />
      </button>
    </div>
  {/if}

  <div class={cn("border-t border-border p-2", collapsed ? "flex justify-center" : "")}>
    <a
      href="https://hiai.gg/docs"
      target="_blank"
      rel="noopener noreferrer"
      class="text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Powered by HiAi-Docs"
    >
      {#if collapsed}
        HiAi
      {:else}
        Powered by HiAi-Docs
      {/if}
    </a>
  </div>
</aside>
