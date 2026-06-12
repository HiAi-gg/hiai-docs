<script lang="ts">
import { cn } from "$lib/utils.js";
import type { HTMLAttributes } from "svelte/elements";

const {
	class: className,
	children,
	...restProps
}: HTMLAttributes<HTMLHeadingElement> = $props();
</script>

<h2 class={cn("text-lg font-semibold leading-none tracking-tight", className)} {...restProps}>
  {@render children?.()}
</h2>
