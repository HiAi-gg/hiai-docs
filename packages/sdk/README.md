# @hiai-gg/hiai-docs-sdk

A typed TypeScript client for the [hiai-docs](https://github.com/hiai-gg/hiai-docs) REST API. Bun-native `fetch`-based wrapper with Bearer auth, typed responses, and automatic retries with exponential backoff.

> Bun-native, ESM-only, TypeScript strict.

---

## Installation

```bash
bun add @hiai-gg/hiai-docs-sdk
# or
npm install @hiai-gg/hiai-docs-sdk
```

The SDK has no runtime dependencies.

## Quick start

```ts
import { DocsClient } from "@hiai-gg/hiai-docs-sdk";

const client = new DocsClient({
  baseUrl: process.env.HIAI_DOCS_URL ?? "http://localhost:50700",
  apiKey: process.env.HIAI_DOCS_API_KEY ?? "",
});

// List documents (paginated, optional folder/tag filter)
const list = await client.listDocs({ folderId: "…", limit: 50 });
console.log(list.items[0].title);

// Read full markdown
const md = await client.getDocMarkdown(list.items[0].id);

// Search (hybrid full-text + semantic)
const hits = await client.search("quarterly planning", { limit: 10 });

// Versioning
const versions = await client.listVersions(docId, { onlySnapshots: true });
const snapshot = await client.createDoc({ title: "v1.0", content: "…" });
```

## Configuration

```ts
new DocsClient({
  baseUrl: string,        // required
  apiKey: string,         // required (matches server-side HIAI_DOCS_API_KEY)
  timeout?: number,       // per-request ms, default 10 000
  retries?: number,       // attempts for 502/503/504/timeouts, default 3
  retryBackoffMs?: number,// initial backoff ms, doubles each attempt, default 250
});
```

## API surface

### Documents
- `createDoc({ title, content, folderId })` → `DocsDocument`
- `getDoc(id)` → `DocsDocument`
- `getDocMarkdown(id)` → `string` (raw markdown)
- `updateDoc(id, { title, content, folderId })` → `DocsDocument`
- `deleteDoc(id)`
- `listDocs({ folderId, tag, page, limit })` → `DocsDocumentListResponse`
- `duplicateDoc(id)` → `DocsDocument`
- `exportDoc(id)` → alias of `getDocMarkdown`
- `importDoc({ title, content, folderId })` → `DocsDocument`

### Folders
- `listFolders(parentId?)` → `DocsFolder[]`
- `getFolder(id)` → `DocsFolder`
- `createFolder({ name, parentId? })` → `DocsFolder`
- `updateFolder(id, { name, parentId })` → `DocsFolder`
- `deleteFolder(id)`

### Tags
- `listTags()` → `DocsTag[]`
- `createTag({ name, color? })` → `DocsTag`
- `updateTag(id, { name, color? })` → `DocsTag`
- `deleteTag(id)`
- `addTagToDoc(documentId, tagId)`
- `removeTagFromDoc(documentId, tagId)`

### Search
- `search(query, { folder, tags, dateFrom, dateTo, sort, page, limit })` → `DocsSearchResponse`
- `suggest(query)` → `DocsSearchSuggestItem[]`

### Share
- `createShare({ documentId, folderId, password, expiresIn })` → `DocsShareLink`
- `listShares()` → `DocsShareListResponse`
- `deleteShare(id)`
- `getShareByToken(token)` → `DocsSharedContent`

### Attachments
- `uploadAttachment(documentId, blob, filename, mimeType)` → `DocsAttachment`
- `listAttachments(documentId)` → `DocsAttachmentListResponse`

### Versions
- `listVersions(documentId, { onlySnapshots, limit })` → `DocsVersion[]`
- `getVersion(documentId, versionId)` → `DocsVersion`

### Health
- `health()` → `DocsHealthResponse`

## Errors

All non-OK responses throw `DocsApiError`:

```ts
import { DocsApiError } from "@hiai-gg/hiai-docs-sdk";

try {
  await client.getDoc(id);
} catch (err) {
  if (err instanceof DocsApiError) {
    console.error(`API ${err.status}:`, err.body);
  } else {
    throw err;
  }
}
```

Network-level failures (DNS, ECONNRESET, ETIMEDOUT, fetch timeout) are wrapped in a plain `Error` with `cause` set to the original.

## Retries

Transient failures are retried automatically with exponential backoff:

- HTTP `502`, `503`, `504`
- Fetch `TimeoutError` / `AbortError`
- Network errors with `cause.code` of `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`

Configure with `retries` (default 3) and `retryBackoffMs` (default 250 ms). Backoff doubles each attempt with up to 25 % jitter.

## Authentication

The SDK always sends `Authorization: Bearer <apiKey>` when `apiKey` is set. The hiai-docs backend accepts Bearer tokens when the server is configured with `HIAI_DOCS_API_KEY=<same value>`.

Generate a key with `openssl rand -hex 32` and put it in `.env` on both the server and the SDK consumer.

## Type safety

Every method returns a strongly-typed shape from `./types`. The `types.ts` file mirrors the backend Elysia routes — keep both in sync if you change the API surface.

## Build & test

```bash
cd packages/sdk
bun run typecheck    # tsc --noEmit
bun run build        # tsc → dist/
```

## License

MIT
