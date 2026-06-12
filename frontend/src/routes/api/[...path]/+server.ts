import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const API_BASE = process.env.API_URL || "http://localhost:50700";

function buildHeaders(request: Request): Headers {
	const headers = new Headers(request.headers);
	headers.delete("content-length");
	return headers;
}

async function getCsrfToken(): Promise<string | null> {
	try {
		const response = await fetch(`${API_BASE}/api/csrf-token`);
		if (response.ok) {
			const data = await response.json();
			return data.token || null;
		}
	} catch {
		return null;
	}
	return null;
}

async function proxy(
	request: Request,
	params: { path?: string },
	fetch: typeof globalThis.fetch,
): Promise<Response> {
	const path = params.path;
	const url = new URL(request.url);
	const targetUrl = `${API_BASE}/api/${path}${url.search}`;

	const headers = buildHeaders(request);

	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		const csrfToken = await getCsrfToken();
		if (csrfToken) {
			headers.set("x-csrf-token", csrfToken);
		}
	}

	const init: RequestInit = {
		method: request.method,
		headers,
		credentials: "include",
	};

	if (
		request.method === "POST" ||
		request.method === "PUT" ||
		request.method === "PATCH"
	) {
		const body = await request.text();
		if (body) {
			init.body = body;
		}
	}

	try {
		const response = await fetch(targetUrl, init);
		const data = await response.text();

		const responseHeaders = new Headers();
		responseHeaders.set(
			"content-type",
			response.headers.get("content-type") || "application/json",
		);

		response.headers.forEach((value, key) => {
			if (key.toLowerCase() === "set-cookie") {
				responseHeaders.append(key, value);
			}
		});

		return new Response(data, {
			status: response.status,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error("API proxy error:", error);
		return json({ error: "Failed to proxy request" }, { status: 502 });
	}
}

export const GET: RequestHandler = async ({ request, params, fetch }) =>
	proxy(request, params, fetch);

export const POST: RequestHandler = async ({ request, params, fetch }) =>
	proxy(request, params, fetch);

export const PUT: RequestHandler = async ({ request, params, fetch }) =>
	proxy(request, params, fetch);

export const PATCH: RequestHandler = async ({ request, params, fetch }) =>
	proxy(request, params, fetch);

export const DELETE: RequestHandler = async ({ request, params, fetch }) =>
	proxy(request, params, fetch);
