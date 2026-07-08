import { validateApiKey } from "./api-keys";
import { auth } from "./auth";
import { config } from "./config";

/**
 * Extract user ID from request headers.
 * Checks API key first (Bearer token), then falls back to Better Auth session.
 * Returns null if no valid session.
 */
export async function getSessionUserId(
	headers: Headers,
): Promise<string | null> {
	// Check API key first (admin key)
	const apiKey = config.HIAI_DOCS_API_KEY;
	if (apiKey) {
		const authHeader = headers.get("authorization");
		if (authHeader?.startsWith("Bearer ")) {
			const token = authHeader.slice(7);
			if (token === apiKey) {
				return config.OWNER_ID;
			}
		}
	}

	// Check user API key (from api_keys table)
	// Graceful: if DB query fails (e.g. missing table in test env), fall through
	const authHeaderVal = headers.get("authorization");
	if (authHeaderVal?.startsWith("Bearer ")) {
		const token = authHeaderVal.slice(7);
		try {
			const keyResult = await validateApiKey(token);
			if (keyResult) {
				return keyResult.ownerId;
			}
		} catch {
			// DB error — treat as no valid key, fall through
		}
	}

	// Fall back to Better Auth session check
	const session = await auth.api.getSession({ headers });
	return session?.user?.id ?? null;
}
