/**
 * REST client for hiai-docs.
 *
 * Pattern mirrors @hiai-docs/mcp-server/src/client.ts: one
 * `request()` helper handles auth headers, query encoding, and
 * error unwrapping; the exported `client` object groups all
 * endpoints into typed methods.
 *
 * Configuration comes from `./config.ts` (file + env), which
 * differs from the MCP server's env-only approach because the CLI
 * is interactive and benefits from a persistent config file.
 *
 * Bun-native. Uses global `fetch`. Throws `HiaiDocsError` on
 * non-2xx responses with the error message extracted from the
 * response body when possible.
 */

import { loadConfig, type Config } from "./config.js";

export class HiaiDocsError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body: unknown,
	) {
		super(message);
		this.name = "HiaiDocsError";
	}
}

interface RequestOptions {
	query?: Record<string, string | number | boolean | string[] | undefined>;
	body?: unknown;
	headers?: Record<string, string>;
	accept?: string;
}

async function request<T>(
	method: string,
	path: string,
	options: RequestOptions = {},
): Promise<T> {
	const cfg = loadConfig();
	const baseUrl = cfg.url.replace(/\/+$/, "");
	const url = new URL(path.startsWith("/") ? path : `/${path}`, `${baseUrl}/`);

	if (options.query) {
		for (const [key, value] of Object.entries(options.query)) {
			if (value === undefined) continue;
			if (Array.isArray(value)) {
				if (value.length > 0) url.searchParams.set(key, value.join(","));
			} else {
				url.searchParams.set(key, String(value));
			}
		}
	}

	const headers: Record<string, string> = {
		Accept: options.accept ?? "application/json",
		...options.headers,
	};
	if (cfg.apiKey) {
		headers["Authorization"] = `Bearer ${cfg.apiKey}`;
	}

	let body: BodyInit | undefined;
	if (options.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(options.body);
	}

	const response = await fetch(url, { method, headers, body });

	const contentType = response.headers.get("content-type") ?? "";
	const isJson = contentType.includes("application/json");
	const payload: unknown = isJson
		? await response.json().catch(() => null)
		: await response.text().catch(() => null);

	if (!response.ok) {
		const message =
			(isJson &&
			payload &&
			typeof payload === "object" &&
			"error" in payload
				? String((payload as { error: unknown }).error)
				: typeof payload === "string" && payload.length > 0
					? payload
					: `HTTP ${response.status} ${response.statusText}`) ||
			`HTTP ${response.status}`;
		throw new HiaiDocsError(message, response.status, payload);
	}

	return payload as T;
}

function joinId(...segments: string[]): string {
	return segments.map((s) => encodeURIComponent(s)).join("/");
}

// --- Response types ----------------------------------------------------------

export interface DocumentSummary {
	id: string;
	title: string;
	content?: string | null;
	folderId?: string | null;
	folderName?: string | null;
	createdAt: string;
	updatedAt: string;
	tags?: Array<{ id: string; name: string; color: string | null }>;
}

export interface DocumentDetail extends DocumentSummary {
	ownerId: string;
	content?: string | null;
	contentJson?: unknown;
	metadata?: unknown;
}

export interface Folder {
	id: string;
	ownerId?: string;
	name: string;
	parentId?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface VersionRow {
	id: string;
	documentId: string;
	createdBy: string;
	createdAt: string;
	label?: string | null;
	description?: string | null;
	isSnapshot: boolean;
	restoredFrom?: string | null;
}

export interface SnapshotRow extends VersionRow {
	content?: string | null;
	contentJson?: unknown;
}

export interface SearchItem {
	id: string;
	title: string;
	snippet: string;
	score: number;
	folder_id?: string | null;
	folder_name?: string | null;
	created_at: string;
	updated_at: string;
	tags?: Array<{ id: string; name: string; color: string | null }>;
}

export interface SearchResponse {
	items: SearchItem[];
	total: number;
	page: number;
	limit: number;
}

export interface ListDocumentsResponse {
	items: DocumentSummary[];
	total: number;
	page: number;
	limit: number;
}

// --- Client ----------------------------------------------------------------

export const client = {
	search(params: {
		query: string;
		folder?: string;
		tags?: string[];
		limit?: number;
	}): Promise<SearchResponse> {
		return request("GET", "/api/search", {
			query: {
				q: params.query,
				folder: params.folder,
				tags: params.tags,
				limit: params.limit,
			},
		});
	},

	listDocuments(params: {
		folderId?: string;
		tag?: string;
		page?: number;
		limit?: number;
	}): Promise<ListDocumentsResponse> {
		return request("GET", "/api/documents", { query: params });
	},

	getDocument(id: string): Promise<DocumentDetail> {
		return request("GET", `/api/${joinId("documents", id)}`);
	},

	createDocument(input: {
		title: string;
		content?: string;
		folderId?: string;
	}): Promise<DocumentDetail> {
		return request("POST", "/api/documents", { body: input });
	},

	updateDocument(
		id: string,
		input: { title?: string; content?: string; folderId?: string | null },
	): Promise<DocumentDetail> {
		return request("PATCH", `/api/${joinId("documents", id)}`, { body: input });
	},

	deleteDocument(id: string): Promise<{ success: boolean }> {
		return request("DELETE", `/api/${joinId("documents", id)}`);
	},

	exportDocument(id: string): Promise<string> {
		return request("GET", `/api/${joinId("documents", id, "export")}`, {
			accept: "text/markdown",
		});
	},

	createSnapshot(
		documentId: string,
		input: { label: string; description?: string },
	): Promise<SnapshotRow> {
		// The backend exposes snapshots via POST /api/documents/:id/versions
		// with isSnapshot=true (see backend/src/api/routes/versions.ts).
		return request(
			"POST",
			`/api/${joinId("documents", documentId, "versions")}`,
			{ body: input },
		);
	},

	listVersions(
		documentId: string,
		onlySnapshots?: boolean,
	): Promise<VersionRow[]> {
		return request(
			"GET",
			`/api/${joinId("documents", documentId, "versions")}`,
			{ query: { onlySnapshots } },
		);
	},

	restoreVersion(documentId: string, versionId: string): Promise<DocumentDetail> {
		return request(
			"POST",
			`/api/${joinId("documents", documentId, "versions", versionId, "restore")}`,
		);
	},

	listFolders(params: { parentId?: string }): Promise<Folder[]> {
		return request("GET", "/api/folders", { query: { parentId: params.parentId } });
	},

	createFolder(input: { name: string; parentId?: string }): Promise<Folder> {
		return request("POST", "/api/folders", { body: input });
	},
};

export type HiaiDocsClient = typeof client;

export type { Config };