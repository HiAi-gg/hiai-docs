<script lang="ts">
import Sidebar from "$lib/components/sidebar/Sidebar.svelte";

const { children } = $props();
</script>

<div class="flex h-screen">
  <Sidebar />
  <main class="flex-1 overflow-auto">
    {@render children()}
  </main>
</div>
