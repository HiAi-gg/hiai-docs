<script lang="ts">
	import "../app.css";
	import { getLocale } from "$lib/paraglide/runtime";

	const { children } = $props();
</script>

<svelte:head>
	<html lang={getLocale()}></html>
	<meta name="description" content="Self-hosted AI-first documentation platform" />
	<meta name="og:type" content="website" />
	<meta name="og:title" content="hiai-docs" />
	<meta name="og:description" content="AI-first documentation platform with semantic search" />
</svelte:head>

{@render children()}
