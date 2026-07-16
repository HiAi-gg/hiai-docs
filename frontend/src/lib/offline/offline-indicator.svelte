<script lang="ts">
import { networkStatus } from "./network-status.svelte";
</script>

{#if !networkStatus.isOnline}
	<div
		class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-yellow-500 px-4 py-2 text-sm text-black shadow-lg"
	>
		Offline — showing locally available content
	</div>
{/if}
