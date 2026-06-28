/**
 * hiai-docs REST API client.
 *
 * Bun-native `fetch` wrapper. All authenticated requests send
 * `Authorization: Bearer <apiKey>`. Non-OK responses throw
 * `DocsApiError` carrying the HTTP status and parsed body. Transient
 * failures (502 / 503 / 504 / timeout / network reset) are retried
 * with exponential backoff up to `config.retries` attempts.
 */

import type {
	DocsAttachment,
	DocsAttachmentListResponse,
	DocsDocument,
	DocsDocumentListResponse,
	DocsFolder,
	DocsHealthResponse,
	DocsSearchResponse,
	DocsSearchSuggestItem,
	DocsShareLink,
	DocsShareListResponse,
	DocsSharedContent,
	DocsTag,
	DocsVersion,
} from "./types.js";

// ---------------------------------------------------------------------------
// Public config
// ---------------------------------------------------------------------------

export interface DocsClientConfig {
	/** Base URL of the hiai-docs API, e.g. `http://localhost:50700`. */
	baseUrl: string;
	/** Bearer token used as `Authorization: Bearer <apiKey>`. */
	apiKey: string;
	/** Per-request timeout in milliseconds. Default: 10 000. */
	timeout?: number;
	/** Retry attempts for transient failures. Default: 3. */
	retries?: number;
	/** Initial backoff in milliseconds (doubles each attempt). Default: 250. */
	retryBackoffMs?: number;
}

type ResolvedConfig = Required<DocsClientConfig>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DocsApiError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(status: number, body: unknown, message?: string) {
		super(message ?? `hiai-docs API error ${status}`);
		this.name = "DocsApiError";
		this.status = status;
		this.body = body;
	}
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class DocsClient {
	private readonly config: ResolvedConfig;

	constructor(config: DocsClientConfig) {
		if (!config.baseUrl) {
			throw new Error("DocsClient: `baseUrl` is required");
		}
		if (!config.apiKey) {
			throw new Error("DocsClient: `apiKey` is required");
		}
		this.config = {
			baseUrl: config.baseUrl.replace(/\/+$/, ""),
			apiKey: config.apiKey,
			timeout: config.timeout ?? 10_000,
			retries: config.retries ?? 3,
			retryBackoffMs: config.retryBackoffMs ?? 250,
		};
	}

	// ── Documents ────────────────────────────────────────────────────────

	async createDoc(input: {
		title?: string;
		content?: string;
		folderId?: string;
	}): Promise<DocsDocument> {
		return this.request<DocsDocument>("POST", "/api/documents", { json: input });
	}

	async getDoc(id: string): Promise<DocsDocument> {
		return this.request<DocsDocument>("GET", `/api/documents/${encodeURIComponent(id)}`);
	}

	/**
	 * Fetch a document as raw markdown via the public export endpoint.
	 * Returns just the markdown body as a string.
	 */
	async getDocMarkdown(id: string): Promise<string> {
		const res = await this.fetchRaw("GET", `/api/documents/${encodeURIComponent(id)}/export`);
		if (!res.ok) {
			throw await this.toApiError(res);
		}
		return res.text();
	}

	async updateDoc(
		id: string,
		updates: {
			title?: string;
			content?: string;
			folderId?: string | null;
		},
	): Promise<DocsDocument> {
		return this.request<DocsDocument>("PATCH", `/api/documents/${encodeURIComponent(id)}`, {
			json: updates,
		});
	}

	async deleteDoc(id: string): Promise<void> {
		await this.request<unknown>("DELETE", `/api/documents/${encodeURIComponent(id)}`);
	}

	async listDocs(options?: {
		folderId?: string;
		tag?: string;
		page?: number;
		limit?: number;
	}): Promise<DocsDocumentListResponse> {
		return this.request<DocsDocumentListResponse>("GET", "/api/documents", {
			query: this.cleanQuery({
				folderId: options?.folderId,
				tag: options?.tag,
				page: options?.page,
				limit: options?.limit,
			}),
		});
	}

	async duplicateDoc(id: string): Promise<DocsDocument> {
		return this.request<DocsDocument>(
			"POST",
			`/api/documents/${encodeURIComponent(id)}/duplicate`,
		);
	}

	/**
	 * Convenience alias for `getDocMarkdown` — both go through the same
	 * `/api/documents/:id/export` endpoint on the backend.
	 */
	async exportDoc(id: string): Promise<string> {
		return this.getDocMarkdown(id);
	}

	/**
	 * Import a document from raw content. Posts JSON to
	 * `POST /api/documents/import`.
	 */
	async importDoc(input: {
		title?: string;
		content: string;
		folderId?: string;
	}): Promise<DocsDocument> {
		return this.request<DocsDocument>("POST", "/api/documents/import", { json: input });
	}

	// ── Folders ──────────────────────────────────────────────────────────

	async listFolders(parentId?: string): Promise<DocsFolder[]> {
		return this.request<DocsFolder[]>("GET", "/api/folders", {
			query: this.cleanQuery({ parentId }),
		});
	}

	async getFolder(id: string): Promise<DocsFolder> {
		return this.request<DocsFolder>("GET", `/api/folders/${encodeURIComponent(id)}`);
	}

	async createFolder(input: { name: string; parentId?: string | null }): Promise<DocsFolder> {
		return this.request<DocsFolder>("POST", "/api/folders", {
			json: { name: input.name, parentId: input.parentId ?? undefined },
		});
	}

	async updateFolder(
		id: string,
		updates: { name?: string; parentId?: string | null },
	): Promise<DocsFolder> {
		return this.request<DocsFolder>("PATCH", `/api/folders/${encodeURIComponent(id)}`, {
			json: updates,
		});
	}

	async deleteFolder(id: string): Promise<void> {
		await this.request<unknown>("DELETE", `/api/folders/${encodeURIComponent(id)}`);
	}

	// ── Tags ─────────────────────────────────────────────────────────────

	async listTags(): Promise<DocsTag[]> {
		return this.request<DocsTag[]>("GET", "/api/tags");
	}

	async createTag(input: { name: string; color?: string }): Promise<DocsTag> {
		return this.request<DocsTag>("POST", "/api/tags", { json: input });
	}

	async updateTag(id: string, updates: { name?: string; color?: string }): Promise<DocsTag> {
		return this.request<DocsTag>("PATCH", `/api/tags/${encodeURIComponent(id)}`, {
			json: updates,
		});
	}

	async deleteTag(id: string): Promise<void> {
		await this.request<unknown>("DELETE", `/api/tags/${encodeURIComponent(id)}`);
	}

	async addTagToDoc(documentId: string, tagId: string): Promise<void> {
		await this.request<unknown>(
			"POST",
			`/api/documents/${encodeURIComponent(documentId)}/tags`,
			{ json: { tagId } },
		);
	}

	async removeTagFromDoc(documentId: string, tagId: string): Promise<void> {
		await this.request<unknown>(
			"DELETE",
			`/api/documents/${encodeURIComponent(documentId)}/tags/${encodeURIComponent(tagId)}`,
		);
	}

	// ── Search ───────────────────────────────────────────────────────────

	async search(
		query: string,
		options?: {
			folder?: string;
			tags?: string;
			dateFrom?: string;
			dateTo?: string;
			sort?: string;
			page?: number;
			limit?: number;
		},
	): Promise<DocsSearchResponse> {
		return this.request<DocsSearchResponse>("GET", "/api/search", {
			query: this.cleanQuery({
				q: query,
				folder: options?.folder,
				tags: options?.tags,
				dateFrom: options?.dateFrom,
				dateTo: options?.dateTo,
				sort: options?.sort,
				page: options?.page,
				limit: options?.limit,
			}),
		});
	}

	async suggest(query: string): Promise<DocsSearchSuggestItem[]> {
		return this.request<DocsSearchSuggestItem[]>("GET", "/api/search/suggest", {
			query: this.cleanQuery({ q: query }),
		});
	}

	// ── Share ────────────────────────────────────────────────────────────

	async createShare(input: {
		documentId?: string;
		folderId?: string;
		password?: string;
		expiresIn?: "1h" | "1d" | "7d" | "30d" | "never";
	}): Promise<DocsShareLink> {
		return this.request<DocsShareLink>("POST", "/api/share", { json: input });
	}

	async listShares(): Promise<DocsShareListResponse> {
		return this.request<DocsShareListResponse>("GET", "/api/share");
	}

	async deleteShare(id: string): Promise<void> {
		await this.request<unknown>("DELETE", `/api/share/${encodeURIComponent(id)}`);
	}

	/**
	 * Public endpoint — still sends `Authorization` if configured, but
	 * the backend does not require it.
	 */
	async getShareByToken(token: string): Promise<DocsSharedContent> {
		return this.request<DocsSharedContent>(
			"GET",
			`/api/share/${encodeURIComponent(token)}`,
		);
	}

	// ── Attachments ──────────────────────────────────────────────────────

	async uploadAttachment(
		documentId: string,
		file: Blob | ArrayBuffer | Uint8Array,
		filename: string,
		mimeType: string,
	): Promise<DocsAttachment> {
		const form = new FormData();
		const blob = this.toBlob(file, mimeType);
		form.append("file", blob, filename);

		const res = await this.fetchRaw(
			"POST",
			`/api/documents/${encodeURIComponent(documentId)}/attachments`,
			{ body: form },
		);
		if (!res.ok) {
			throw await this.toApiError(res);
		}
		return (await res.json()) as DocsAttachment;
	}

	async listAttachments(documentId: string): Promise<DocsAttachmentListResponse> {
		return this.request<DocsAttachmentListResponse>(
			"GET",
			`/api/documents/${encodeURIComponent(documentId)}/attachments`,
		);
	}

	// ── Versions ─────────────────────────────────────────────────────────

	async listVersions(
		documentId: string,
		options?: { onlySnapshots?: boolean; limit?: number },
	): Promise<DocsVersion[]> {
		return this.request<DocsVersion[]>(
			"GET",
			`/api/documents/${encodeURIComponent(documentId)}/versions`,
			{
				query: this.cleanQuery({
					onlySnapshots: options?.onlySnapshots,
					limit: options?.limit,
				}),
			},
		);
	}

	async getVersion(documentId: string, versionId: string): Promise<DocsVersion> {
		return this.request<DocsVersion>(
			"GET",
			`/api/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}`,
		);
	}

	// ── Health ───────────────────────────────────────────────────────────

	async health(): Promise<DocsHealthResponse> {
		return this.request<DocsHealthResponse>("GET", "/api/health");
	}

	// ─────────────────────────────────────────────────────────────────────
	// Internal: HTTP plumbing
	// ─────────────────────────────────────────────────────────────────────

	private async request<T>(
		method: string,
		path: string,
		options?: { json?: unknown; query?: Record<string, string | number | boolean | undefined> },
	): Promise<T> {
		const res = await this.fetchRaw(method, path, {
			json: options?.json,
			query: options?.query,
		});
		if (!res.ok) {
			throw await this.toApiError(res);
		}
		// 204 / empty bodies: return undefined cast to T
		const contentType = res.headers.get("content-type") ?? "";
		if (res.status === 204 || res.body === null) {
			return undefined as T;
		}
		if (contentType.includes("application/json")) {
			return (await res.json()) as T;
		}
		// Fall back to text for non-JSON success responses (e.g. raw markdown export).
		return (await res.text()) as unknown as T;
	}

	private async fetchRaw(
		method: string,
		path: string,
		options?: {
			json?: unknown;
			query?: Record<string, string | number | boolean | undefined>;
			body?: BodyInit;
		},
	): Promise<Response> {
		const url = this.buildUrl(path, options?.query);
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.config.apiKey}`,
		};

		let body: BodyInit | undefined;
		if (options?.body !== undefined) {
			// Caller-supplied body (e.g. FormData) — set Content-Type if it's a Blob.
			body = options.body;
		} else if (options?.json !== undefined) {
			body = JSON.stringify(options.json);
			headers["Content-Type"] = "application/json";
		}

		const init: RequestInit = { method, headers };
		if (body !== undefined) init.body = body;

		let lastError: unknown = null;
		const maxAttempts = Math.max(1, this.config.retries);
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const signal = AbortSignal.timeout(this.config.timeout);
			try {
				const res = await fetch(url, { ...init, signal });
				if (this.shouldRetryStatus(res.status) && attempt < maxAttempts - 1) {
					await this.sleep(this.backoffDelay(attempt));
					continue;
				}
				return res;
			} catch (err) {
				lastError = err;
				if (!this.isRetryableError(err) || attempt === maxAttempts - 1) {
					throw this.wrapNetworkError(err);
				}
				await this.sleep(this.backoffDelay(attempt));
			}
		}

		// Should be unreachable — the loop above either returns or throws.
		throw this.wrapNetworkError(lastError);
	}

	private buildUrl(
		path: string,
		query?: Record<string, string | number | boolean | undefined>,
	): string {
		let url = `${this.config.baseUrl}${path}`;
		if (query && Object.keys(query).length > 0) {
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(query)) {
				if (value === undefined || value === null) continue;
				params.append(key, String(value));
			}
			const qs = params.toString();
			if (qs) url += (url.includes("?") ? "&" : "?") + qs;
		}
		return url;
	}

	private cleanQuery(
		query: Record<string, string | number | boolean | undefined | null>,
	): Record<string, string | number | boolean | undefined> {
		const out: Record<string, string | number | boolean | undefined> = {};
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null) continue;
			out[key] = value;
		}
		return out;
	}

	private shouldRetryStatus(status: number): boolean {
		return status === 502 || status === 503 || status === 504;
	}

	private isRetryableError(err: unknown): boolean {
		if (!(err instanceof Error)) return false;
		// AbortSignal.timeout surfaces as DOMException with name "TimeoutError"
		// or as a plain Error with name "AbortError" in some runtimes.
		if (err.name === "TimeoutError" || err.name === "AbortError") return true;
		// Connection resets / DNS failures etc. come through as TypeError
		// wrapping a system error code.
		const cause = (err as Error & { cause?: { code?: string } }).cause;
		if (cause?.code === "ECONNRESET") return true;
		if (cause?.code === "ECONNREFUSED") return true;
		if (cause?.code === "ETIMEDOUT") return true;
		return false;
	}

	private backoffDelay(attempt: number): number {
		// Exponential backoff: 1x, 2x, 4x ... with light jitter.
		const base = this.config.retryBackoffMs * 2 ** attempt;
		const jitter = Math.random() * base * 0.25;
		return Math.floor(base + jitter);
	}

	private async sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private async toApiError(res: Response): Promise<DocsApiError> {
		const contentType = res.headers.get("content-type") ?? "";
		let body: unknown;
		try {
			body = contentType.includes("application/json") ? await res.json() : await res.text();
		} catch {
			body = null;
		}
		const message =
			body && typeof body === "object" && "error" in body && typeof body.error === "string"
				? body.error
				: `hiai-docs API error ${res.status}`;
		return new DocsApiError(res.status, body, message);
	}

	private wrapNetworkError(err: unknown): Error {
		if (err instanceof Error) {
			// Preserve the original message for debugging while making the
			// type explicit at the boundary.
			const wrapped = new Error(`hiai-docs network error: ${err.message}`);
			wrapped.cause = err;
			return wrapped;
		}
		return new Error(`hiai-docs network error: ${String(err)}`);
	}

	private toBlob(file: Blob | ArrayBuffer | Uint8Array, mimeType: string): Blob {
		if (file instanceof Blob) {
			// Re-wrap with explicit MIME if the caller passed one.
			if (file.type && file.type !== mimeType) {
				return new Blob([file], { type: mimeType });
			}
			return file;
		}
		if (file instanceof ArrayBuffer) {
			return new Blob([file], { type: mimeType });
		}
		if (file instanceof Uint8Array) {
			// TS 5.9 widened `Uint8Array<ArrayBufferLike>` which is not a
			// direct `BlobPart`. Copy into a fresh `Uint8Array<ArrayBuffer>`
			// to satisfy the Blob constructor.
			const copy = new Uint8Array(file.byteLength);
			copy.set(file);
			return new Blob([copy], { type: mimeType });
		}
		// Unreachable — covered by the union — but TS strict requires it.
		throw new Error("DocsClient.uploadAttachment: unsupported file type");
	}
}