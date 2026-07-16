<script lang="ts">
import { Menu } from "lucide-svelte";
import { mobileSidebar } from "$lib/stores/mobile-sidebar.svelte";

let {
	buttonRef = $bindable(null),
	controls = "mobile-navigation",
}: {
	buttonRef?: HTMLButtonElement | null;
	controls?: string;
} = $props();

function handleClick() {
	mobileSidebar.toggle();
}
</script>

<!-- Hamburger toggle: only visible below the md (768px) breakpoint.
     Sits above main content (z-0) but below the sheet overlay (z-40) and
     sheet content (z-50). Touch target is 44x44px (size-11). -->
<button
	bind:this={buttonRef}
	type="button"
	onclick={handleClick}
	aria-label={mobileSidebar.open
		? "Close navigation menu"
		: "Open navigation menu"}
	aria-expanded={mobileSidebar.open}
	aria-controls={controls}
	class="fixed left-3 top-3 z-30 flex size-11 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent md:hidden"
	style="top: calc(0.75rem + env(safe-area-inset-top));"
>
	<Menu class="size-5" />
</button>
