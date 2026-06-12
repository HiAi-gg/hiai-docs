<script lang="ts">
import { cn } from "$lib/utils.js";
import type { HTMLAttributes } from "svelte/elements";

const {
	class: className,
	children,
	...restProps
}: HTMLAttributes<HTMLParagraphElement> = $props();
</script>

<p class={cn("text-sm text-muted-foreground", className)} {...restProps}>
  {@render children?.()}
</p>
