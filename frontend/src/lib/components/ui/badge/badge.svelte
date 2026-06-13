<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import type { WithElementRef } from "$lib/utils.js";
import type { BadgeVariant } from "./index.js";
import { cn } from "$lib/utils";


let {
	ref = $bindable(null),
	class: className,
	variant = "default",
	children,
	...restProps
}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	variant?: BadgeVariant;
} = $props();
</script>

<div bind:this={ref} class={cn(badgeVariants({ variant }), className)} {...restProps}>
  {@render children?.()}
</div>
