<script lang="ts">
import type { Snippet } from "svelte";
import { provideFrontendExtensions } from "../extensions/context";
import type { HiaiDocsFrontendExtensions } from "../extensions/types";

const {
	extensions = {},
	children,
}: {
	extensions?: Partial<HiaiDocsFrontendExtensions>;
	children: Snippet;
} = $props();

// Svelte context is scoped to this component tree, so each SSR request and
// each mounted product host receives an isolated extension manifest.
// svelte-ignore state_referenced_locally -- manifests are intentionally immutable per mounted host
provideFrontendExtensions(extensions);
</script>

{@render children()}
