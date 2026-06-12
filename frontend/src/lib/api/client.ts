interface FetchOptions extends RequestInit {
	timeout?: number;
}

export async function apiFetch<T>(
	path: string,
	options: FetchOptions = {},
): Promise<T> {
	const { timeout = 10000, body, ...fetchOptions } = options;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	const headers: Record<string, string> = {};
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	try {
		const response = await fetch(path, {
			...fetchOptions,
			body,
			signal: controller.signal,
			headers: {
				...headers,
				...fetchOptions.headers,
			},
			credentials: "include",
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: response.statusText }));
			throw new Error(error.error ?? `HTTP ${response.status}`);
		}

		return response.json() as Promise<T>;
	} finally {
		clearTimeout(timeoutId);
	}
}
