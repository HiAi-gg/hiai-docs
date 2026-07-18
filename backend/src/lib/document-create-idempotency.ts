const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function documentCreateIdempotencyKey(
	request: Request,
): string | null | "invalid" {
	const value = request.headers.get("idempotency-key");
	if (value === null) return null;
	return IDEMPOTENCY_KEY_PATTERN.test(value) ? value : "invalid";
}

/** Personal contexts are verified actor scopes even without an external workspace assertion. */
export function documentCreateWorkspaceIdentity(
	userId: string,
	workspaceId: string | undefined,
): string {
	return workspaceId ?? `personal:${userId}`;
}
