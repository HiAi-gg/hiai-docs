<script lang="ts">
import type { ButtonProps } from "./index.js";
import { cn } from "$lib/utils";


let {
	ref = $bindable(null),
	class: className,
	variant = "default",
	size = "default",
	children,
	...restProps
}: ButtonProps = $props();
</script>

<button
  bind:this={ref}
  class={cn(buttonVariants({ variant, size }), className)}
  {...restProps}
>
  {@render children?.()}
</button>
