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
