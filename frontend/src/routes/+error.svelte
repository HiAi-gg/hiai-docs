<script lang="ts">
import { page } from "$app/stores";
import * as m from "$lib/paraglide/messages.js";
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="text-center">
    <h1 class="text-4xl font-bold">{$page.status}</h1>
    <p class="mt-2 text-muted-foreground">{$page.error?.message ?? m.error_generic()}</p>
    <a href="/" class="mt-4 inline-block text-primary underline">{m.action_back()}</a>
  </div>
</div>
