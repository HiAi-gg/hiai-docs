import type { MutationOp } from "./index";

/** Legacy API retained for one schema-upgrade compatibility cycle. */
export async function enqueueMutation(
	_docId: string,
	_op: MutationOp,
	_payload: unknown,
	_expectedUpdatedAt: string,
): Promise<void> {
	throw new Error(
		"Automatic mutation replay is disabled; create a local draft instead",
	);
}

/** Legacy rows are removed during the schema upgrade and no pending work exists. */
export async function getPendingCount(): Promise<number> {
	return 0;
}

/** Legacy compatibility no-op: reconnect must never issue a mutation. */
export async function processQueue(): Promise<void> {
	return;
}

/** Legacy compatibility no-op. */
export function initOfflineSync(): void {
	// Deliberately empty: reconnect must never issue mutation requests.
}
