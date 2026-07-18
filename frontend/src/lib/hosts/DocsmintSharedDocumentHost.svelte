<script lang="ts">
import type { Snippet } from "svelte";
import { getFrontendExtensions } from "../extensions/context";
import { sanitizeSharedDocumentExtensionContext } from "../extensions/shared-document-context";
import type {
	SharedDocumentExtension,
	SharedDocumentExtensionContext,
} from "../extensions/types";

const {
	context,
	children,
}: {
	context: SharedDocumentExtensionContext;
	children: Snippet;
} = $props();

const extensions = getFrontendExtensions();
const safeContext = $derived(sanitizeSharedDocumentExtensionContext(context));
function permitted(extension: SharedDocumentExtension) {
	return extension.permission === "annotate"
		? safeContext.permissions.annotate
		: safeContext.permissions.edit;
}
function visible(items: readonly SharedDocumentExtension[]) {
	const seen = new Set<string>();
	return items
		.filter((extension) => {
			if (seen.has(extension.id) || !permitted(extension)) return false;
			seen.add(extension.id);
			try {
				return extension.visible?.(safeContext) ?? true;
			} catch {
				return false;
			}
		})
		.sort(
			(a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
		);
}
</script>

<div data-docsmint-shared-document-host>
	<div data-extension-zone="shared-header-actions">
		{#each visible(extensions.sharedDocumentHeaderActions) as extension (extension.id)}
			<extension.component context={safeContext} />
		{/each}
	</div>
	{@render children()}
	<div data-extension-zone="shared-document-tabs">
		{#each visible(extensions.sharedDocumentTabs) as extension (extension.id)}
			<extension.component context={safeContext} />
		{/each}
	</div>
	<div data-extension-zone="shared-document-notes">
		{#each visible(extensions.sharedDocumentNotesModes) as extension (extension.id)}
			<extension.component context={safeContext} />
		{/each}
	</div>
	<div data-extension-zone="shared-document-editor">
		{#if safeContext.permissions.edit}
			{#each visible(extensions.sharedDocumentEditorModes) as extension (extension.id)}
				<extension.component context={safeContext} />
			{/each}
		{/if}
	</div>
</div>
