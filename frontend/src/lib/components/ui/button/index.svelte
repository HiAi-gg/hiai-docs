<script lang="ts">
import type { ButtonProps } from "./index.js";
import { cn } from "$lib/utils";


let {
	class: className,
	variant = "default",
	size = "default",
	ref = $bindable(null),
	href = undefined,
	children,
	...restProps
}: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    {href}
    class={cn(buttonVariants({ variant, size }), className)}
    {...restProps as Record<string, unknown>}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    class={cn(buttonVariants({ variant, size }), className)}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
