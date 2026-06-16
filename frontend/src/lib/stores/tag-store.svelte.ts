// tag-store.svelte.ts — Module-level reactive signal for cross-component
// tag list refresh. The sidebar TagList loads tags only on mount, so any
// tag mutation elsewhere (e.g. the document editor) needs to nudge it to
// reload. We expose a simple monotonically-increasing nonce that callers
// can read inside a $effect to trigger refreshes.

let tagRefreshNonce = $state(0);

export function refreshTags(): void {
	tagRefreshNonce++;
}

export function getTagRefreshNonce(): number {
	return tagRefreshNonce;
}

// Module-level reactive signal for cross-component document list refresh.
// The sidebar components (RecentDocs, FolderTree) and any other doc
// consumer load documents only on mount, so any document mutation
// elsewhere (e.g. the dashboard Import button) needs to nudge them to
// reload. Same nonce pattern as tagRefreshNonce: callers read it inside
// a $effect to trigger refreshes.
let docRefreshNonce = $state(0);

export function refreshDocs(): void {
	docRefreshNonce++;
}

export function getDocRefreshNonce(): number {
	return docRefreshNonce;
}
