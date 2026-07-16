<script lang="ts">
import { ArrowUp } from "lucide-svelte";
import { onDestroy } from "svelte";
import * as m from "$lib/paraglide/messages.js";

const SCROLL_THRESHOLD = 300;

let {
	scrollTarget,
	avoidEditorToolbar = false,
}: {
	scrollTarget?: HTMLElement | null;
	avoidEditorToolbar?: boolean;
} = $props();

let visible = $state(false);
let activeTarget: HTMLElement | null = null;

function handleScroll() {
	visible =
		(activeTarget ? activeTarget.scrollTop : window.scrollY) > SCROLL_THRESHOLD;
}

function scrollToTop() {
	if (activeTarget) {
		activeTarget.scrollTo({ top: 0, behavior: "smooth" });
	} else {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}
}

function attach(target: HTMLElement | null | undefined) {
	detach();
	if (!target) return;
	activeTarget = target;
	target.addEventListener("scroll", handleScroll, { passive: true });
	handleScroll();
}

function detach() {
	if (activeTarget) {
		activeTarget.removeEventListener("scroll", handleScroll);
	}
	activeTarget = null;
}

// React to changes in scrollTarget so we always listen on the right element.
// When scrollTarget is undefined, fall back to window-level scroll.
$effect(() => {
	const target = scrollTarget;
	attach(target);
	if (!target) {
		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();
		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}
	return () => {
		detach();
	};
});

onDestroy(() => {
	detach();
	visible = false;
});
</script>

<button
	type="button"
	class:avoid-editor-toolbar={avoidEditorToolbar}
	class="scroll-to-top fixed bottom-6 right-6 z-50 inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}"
	aria-label={m.scroll_to_top_aria()}
	title={m.scroll_to_top_aria()}
	onclick={scrollToTop}
>
	<ArrowUp class="size-5" />
</button>

<style>
	@media (max-width: 640px) {
		.scroll-to-top.avoid-editor-toolbar {
			bottom: calc(min(42vh, 260px) + max(22px, env(safe-area-inset-bottom)));
		}
	}
</style>
