# API Reference

Base URL: `http://localhost:50700`

All responses are JSON. Errors follow `{ error: string, details?: unknown }`.

## Authentication

Most endpoints require a valid Better Auth session cookie. Public endpoints (health check, shared content access) are noted below.

```bash
# Sign in (sets session cookie)
curl -X POST http://localhost:50700/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret"}'

# Sign up
curl -X POST http://localhost:50700/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"name": "User", "email": "user@example.com", "password": "secret"}'

# Get current session
curl http://localhost:50700/api/auth/session

# Sign out
curl -X POST http://localhost:50700/api/auth/sign-out
```

## Health

```
GET /api/health           # → { status: "ok", timestamp: "..." }
```

## Documents

```
GET  /api/documents       # List (paginated)
POST /api/documents       # Create
GET  /api/documents/:id   # Get with tags
PATCH /api/documents/:id  # Update (saves version)
DELETE /api/documents/:id # Delete (cascade)
```

### List documents

```bash
curl "http://localhost:50700/api/documents?page=1&limit=20&folderId=UUID&tag=UUID"
```

Response: `{ items: Document[], total: number, page: number, limit: number }`

### Create document

```bash
curl -X POST http://localhost:50700/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "My Doc", "content": "Hello world", "folderId": "UUID"}'
```

### Update document

```bash
curl -X PATCH http://localhost:50700/api/documents/UUID \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated", "content": "New content"}'
```

## Folders

```
GET    /api/folders         # List (tree)
POST   /api/folders         # Create
PATCH  /api/folders/:id     # Rename/move
DELETE /api/folders/:id     # Delete
```

### List folders

```bash
curl "http://localhost:50700/api/folders?parentId=UUID"
```

Returns root folders when `parentId` is omitted.

### Create folder

```bash
curl -X POST http://localhost:50700/api/folders \
  -H "Content-Type: application/json" \
  -d '{"name": "My Folder", "parentId": "UUID"}'
```

## Search

```
GET /api/search           # Full-text + semantic search (PUBLIC)
GET /api/search/suggest   # Quick title suggestions (PUBLIC)
```

### Full search

```bash
curl "http://localhost:50700/api/search?q=query&folderId=UUID&tag=UUID&page=1&limit=20"
```

Response: `{ items: SearchResult[], total, page, limit }` where each item has `id, title, snippet, score, folder_id, created_at, updated_at`.

### Quick suggest

```bash
curl "http://localhost:50700/api/search/suggest?q=deploy"
```

Returns top 5 title matches with similarity scores.

## Share Links

```
GET    /api/share           # List user's share links
POST   /api/share           # Create link
GET    /api/share/:token    # Access shared content (PUBLIC)
DELETE /api/share/:id       # Revoke link
POST   /api/share/:id/guests  # Add guest email
```

### Create share link

```bash
curl -X POST http://localhost:50700/api/share \
  -H "Content-Type: application/json" \
  -d '{"documentId": "UUID", "password": "optional", "expiresIn": "7d"}'
```

Expires options: `1h`, `1d`, `7d`, `30d`, `never`.

### Access shared content

```bash
# Public — no auth required. Rate limited: 10 req/min per IP.
curl http://localhost:50700/api/share/TOKEN

# With password
curl http://localhost:50700/api/share/TOKEN \
  -H "x-share-password: secret"
```

Returns 410 Gone if expired, 401 if password required/invalid.

## Tags

```
GET    /api/tags                        # List tags with counts
POST   /api/tags                       # Create tag
PATCH  /api/tags/:id                   # Update tag
DELETE /api/tags/:id                   # Delete tag
POST   /api/documents/:docId/tags      # Tag document
DELETE /api/documents/:docId/tags/:tagId # Untag document
```

## Agent Integration

hiai-docs is designed for AI agent integration via its REST API. Use API key authentication for programmatic access.

### API Key Auth

Set `HIAI_DOCS_API_KEY` in your `.env` file. All API requests use Bearer token:

```bash
curl -H "Authorization: Bearer $HIAI_DOCS_API_KEY" \
  http://localhost:50700/api/documents
```

### Semantic Search (RAG)

```bash
# Search documents by meaning (hybrid full-text + vector)
curl -H "Authorization: Bearer $HIAI_DOCS_API_KEY" \
  "http://localhost:50700/api/search?q=how+to+deploy+docker"

# Response includes relevance scores:
# { items: [{ id, title, content, score, rank }] }
```

### Document CRUD for Agents

```bash
# Create document
curl -X POST http://localhost:50700/api/documents \
  -H "Authorization: Bearer $HIAI_DOCS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Agent Note", "content": "Important finding..."}'

# Read document
curl -H "Authorization: Bearer $HIAI_DOCS_API_KEY" \
  http://localhost:50700/api/documents/UUID

# Update document
curl -X PATCH http://localhost:50700/api/documents/UUID \
  -H "Authorization: Bearer $HIAI_DOCS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated with new findings..."}'
```

### Mastra Integration

```typescript
import { Mastra } from "@mastra/core";

const docsTool = {
  name: "search_knowledge",
  description: "Search the knowledge base for relevant documents",
  execute: async ({ query }) => {
    const res = await fetch(
      `http://localhost:50700/api/search?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${process.env.HIAI_DOCS_API_KEY}` } }
    );
    return res.json();
  },
};
```

## Error Codes

| Code | Meaning |
|------|---------|
| 400  | Validation error (check `details`) |
| 401  | Not authenticated |
| 403  | Forbidden (not owner) |
| 404  | Resource not found |
| 410  | Share link expired |
| 429  | Rate limited (check `retry-after` header) |
| 500  | Internal server error |
