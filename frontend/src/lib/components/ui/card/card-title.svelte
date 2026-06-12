<script lang="ts">
import type { WithElementRef } from "$lib/utils.js";
import { cn } from "$lib/utils.js";
import type { HTMLAttributes } from "svelte/elements";

let {
	ref = $bindable(null),
	class: className,
	children,
	...restProps
}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div bind:this={ref} class={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...restProps}>
  {@render children?.()}
</div>
