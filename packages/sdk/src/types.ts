/**
 * TypeScript interfaces for the hiai-docs REST API.
 *
 * All shapes are derived from the actual Elysia routes in
 * `backend/src/api/routes/` — keep this file in sync if the backend
 * response shapes change.
 */

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Full document record returned by `GET /api/documents/:id` and the
 * create / duplicate / update endpoints. The list endpoint returns a
 * trimmed shape (`DocsDocumentListItem`) — `DocsDocumentListItem` is a
 * structural superset of `DocsDocument` and the list item omits the
 * full `content` (only the first 200 chars), `contentJson`, and
 * `metadata` fields.
 */
export interface DocsDocument {
	id: string;
	ownerId: string;
	folderId: string | null;
	title: string;
	content: string;
	contentJson?: unknown;
	metadata?: unknown;
	createdAt: string;
	updatedAt: string;
	tags?: DocsTag[];
	folderName?: string | null;
}

/**
 * Document item returned by `GET /api/documents` (list endpoint).
 * `content` is truncated to 200 chars server-side, `contentJson` and
 * `metadata` are not included.
 */
export interface DocsDocumentListItem {
	id: string;
	title: string;
	content: string;
	folderId: string | null;
	createdAt: string;
	updatedAt: string;
	tags: DocsTag[];
}

export interface DocsDocumentListResponse {
	items: DocsDocumentListItem[];
	total: number;
	page: number;
	limit: number;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export interface DocsFolder {
	id: string;
	ownerId: string;
	parentId: string | null;
	name: string;
	createdAt: string;
	updatedAt: string;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

/**
 * Full tag record returned by create / update / list.
 * `listTags()` also returns `documentCount` and `createdAt`; create
 * and update return the bare row. Both shapes are accommodated.
 */
export interface DocsTag {
	id: string;
	name: string;
	color: string | null;
	createdAt?: string;
	documentCount?: number;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search hit as returned by `GET /api/search`. The backend uses
 * snake_case in the JSON payload — we mirror that exactly here so
 * consumers don't need to remap.
 */
export interface DocsSearchResult {
	id: string;
	title: string;
	snippet: string;
	score: number;
	folder_id: string | null;
	folder_name: string | null;
	created_at: string;
	updated_at: string;
	tags?: DocsTag[];
}

export interface DocsSearchResponse {
	items: DocsSearchResult[];
	total: number;
	page: number;
	limit: number;
}

/**
 * Suggestion hit returned by `GET /api/search/suggest`.
 */
export interface DocsSearchSuggestItem {
	id: string;
	title: string;
	score: number;
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

export interface DocsShareLink {
	id: string;
	token: string;
	documentId: string | null;
	folderId: string | null;
	expiresAt: string | null;
	hasPassword: boolean;
	createdAt: string;
}

/**
 * `GET /api/share` returns a richer list item with `title` and `type`
 * derived from the joined document / folder row.
 */
export interface DocsShareLinkListItem {
	id: string;
	token: string;
	documentId: string | null;
	folderId: string | null;
	hasPassword: boolean;
	expiresAt: string | null;
	createdAt: string;
	title: string;
	type: "document" | "folder";
}

export interface DocsShareListResponse {
	links: DocsShareLinkListItem[];
}

/**
 * Response of `GET /api/share/:token` (public, no auth). The shape is
 * a discriminated union — narrow on `type` to access the right `data`.
 */
export type DocsSharedContent =
	| {
			type: "document";
			data: {
				id: string;
				title: string;
				content: string | null;
				contentJson: unknown;
				metadata: unknown;
				createdAt: string;
				updatedAt: string;
			};
	  }
	| {
			type: "folder";
			data: {
				id: string;
				name: string;
				createdAt: string;
				updatedAt: string;
				documents: Array<{
					id: string;
					title: string;
					createdAt: string;
					updatedAt: string;
				}>;
			};
	  };

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface DocsAttachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	url: string;
}

export interface DocsAttachmentListResponse {
	items: DocsAttachment[];
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export interface DocsVersion {
	id: string;
	documentId: string;
	content: string;
	contentJson?: unknown;
	createdBy: string;
	createdAt: string;
	label?: string | null;
	description?: string | null;
	isSnapshot?: boolean;
	restoredFrom?: string | null;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface DocsHealthResponse {
	status: string;
	service: string;
	timestamp: string;
}