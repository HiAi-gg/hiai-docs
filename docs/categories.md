# Categories

> Status: **stable** (added in the 5-features rollout)
> Schema migration: `0004_bouncy_pet_avengers.sql`

Categories are a classification layer that sits *above* the folder
hierarchy. A single document or folder can carry at most one category;
removing a category automatically detaches it from every assignee
(`ON DELETE SET NULL`).

## Concepts

- **Folder hierarchy** organises *where a document lives*.
- **Categories** organise *what a document is about*.

This split lets you keep your filing structure (e.g. `Notes / 2026 / Q1`)
independent of your topical structure (e.g. `Research`, `Engineering`,
`Personal`). Either dimension can be re-organised without touching the
other.

## Database

`categories` is a standalone user-scoped table:

| Column      | Type        | Notes                                |
| ----------- | ----------- | ------------------------------------ |
| `id`        | `uuid`      | Primary key, server-generated.       |
| `owner_id`  | `uuid`      | FK → `users.id`. Every query filters by `owner_id`. |
| `name`      | `text`      | 1..255 chars after trim. Unique per owner. |
| `created_at`| `timestamptz` | Default `now()`.                  |
| `updated_at`| `timestamptz` | Bumped on rename.                 |

`documents.category_id` and `folders.category_id` are nullable FKs that
use `ON DELETE SET NULL`, so deleting a category never cascades into
deleting folders or documents.

## REST API

All routes require an authenticated session.

### `GET /api/categories`

Returns every category owned by the caller, alphabetised by name. Each
row includes computed `documentCount` and `folderCount` so the sidebar
can render per-category badges without an N+1 lookup.

```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Research",
    "documentCount": 12,
    "folderCount": 2,
    "createdAt": "2026-04-12T10:14:22.913Z",
    "updatedAt": "2026-04-12T10:14:22.913Z"
  }
]
```

### `POST /api/categories`

Body: `{ "name": "Research" }`

- `201 Created` with the new row on success.
- `400 Bad Request` if `name` is empty, > 255 chars, or not a string.
- `409 Conflict` if the caller already owns a category with that name.

### `PATCH /api/categories/:id`

Body: `{ "name": "New name" }`. The body must include at least one
field — empty PATCH bodies are rejected with `400` to avoid no-op writes.

- `200 OK` with the updated row.
- `404 Not Found` if the id is unknown *or owned by someone else*.
- `409 Conflict` on a name collision with another category owned by the
  caller (the same-name idempotent case returns `200`).

### `DELETE /api/categories/:id`

- `200 OK` with `{ "success": true }` on success.
- `404 Not Found` for unknown ids and for ids owned by other users.

## Assigning a category

Categories are attached to documents and folders via the existing
PATCH endpoints — no dedicated `/category` route is needed.

```http
PATCH /api/documents/00000000-0000-4000-8000-000000000001
Content-Type: application/json

{ "categoryId": "11111111-1111-4111-8111-111111111111" }
```

Set `categoryId: null` to detach. Assigning a folder's category is
exposed through `PATCH /api/folders/:id` (folder-side support ships with
the same release).

The PATCH handler detects the `categoryId` (or `folderId`) change and
re-enqueues the document for embedding so the chunk-text preamble
reflects the new metadata. See [Embedding Metadata](embedding-metadata.md)
for the full list of fields that get enriched.

## Search integration

The search page accepts a `?category=<uuid>` filter. A document matches
the category filter when either:

1. its own `category_id` equals the supplied UUID, **or**
2. its folder's `category_id` equals the supplied UUID.

The category clause composes with all existing filters
(`folder`, `tags`, `dateFrom`, `dateTo`, `titleFirst`).

See `docs/keyboard-shortcuts.md` for the in-app keyboard bindings that
operate on categories (open QuickSearch with `⌘K`, jump into the
sidebar with the focus shortcut).
