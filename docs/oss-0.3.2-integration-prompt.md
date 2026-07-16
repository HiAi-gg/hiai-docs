# DocsMint OSS 0.3.2 integration contract

## Boundary

This release is backend/package integration only. It must not change rendered
frontend behavior, markup, styles, routes, or product workflows. It exposes
stable package seams for a later SaaS host.

## Lifecycle

The only lifecycle path is `@hiai-gg/docsmint/lifecycle`; do not create or
import `@hiai-gg/docsmint/server/privacy`.

```ts
export type PurgeUserDataContext = Readonly<{
  actorUserId: string;
  requestId: string;
  idempotencyKey: string;
  reason: "account_deletion" | "privacy_request";
  signal?: AbortSignal;
}>;
```

In 0.3.2 `actorUserId` is both the caller and subject account. Introducing a
separate subject requires a future minor-version contract. Operations are
unique by `(actor_user_id, idempotency_key)`.

The lifecycle exports `exportUserData(ctx): AsyncIterable<UserDataExportRecord>`,
`purgeUserData(ctx)`, and `encodeUserDataExportNdjson(records)`. The encoder
emits one complete JSON object per newline. The first record is `manifest`; a
successful final `complete` record contains `recordCount` and `checksum`.
Missing `complete` means incomplete output. Abort and backpressure propagate
to adapters.

Purge is a durable, lease-protected, retry-safe saga. It fails closed, writes
only redacted audit data, runs upstream purge before Better Auth deletion, and
never logs documents, tokens, or secrets. It removes account-owned OSS
documents, versions, attachments/objects, created shares, graph state,
collaboration state, cache/locks/dedup keys, and queued work. SaaS overlays are
host-registered steps; workspace lifecycle, other members, billing, and
non-owned resources are out of scope.

The host gate returns a fence token. It must lock/check final ownership through
durable operation creation or revalidate immediately before the first
irreversible mutation. A rejected gate changes no user data; completed saga
steps must not repeat destructive effects.

`lifecycle_operations` is the durable OSS saga record. It contains only a
fence-token hash, lease metadata, completed step IDs, allowlisted safe error
codes, and redacted count metadata; terminal operations are immutable. The
backend factory accepts concrete storage, queue, Redis, graph, and
collaboration adapters plus deterministically ordered host steps. It does not
import downstream schemas or derive ownership from a client workspace ID.

## Cursor listing

`DocsClient.listDocuments({ categoryId, cursor, limit }, ctx)` is cursor based;
the legacy page API remains unchanged. Limits are 1–100, default 50. Cursors
are base64url JSON:

```ts
type DocumentCursorV1 = Readonly<{
  v: 1; updatedAt: string; id: string; scopeHash: string;
}>;
```

Apply verified workspace, actor authorization, category, visibility, and then
cursor filtering. Order with `updated_at DESC, id DESC`; the continuation is
`updated_at < cursor.updated_at OR (updated_at = cursor.updated_at AND id <
cursor.id)`. Fetch `limit + 1`; return a cursor only for an extra row. A
malformed or scope-mismatched cursor returns 400.

## Storage

Use `STORAGE_INTERNAL_ENDPOINT_URL` only for API/workers and
`STORAGE_PUBLIC_ENDPOINT_URL` only for browser presigning. Production public
endpoints must be HTTPS; local development may use localhost HTTP. A generated
presigned URL must use the public endpoint and never disclose internal Docker
hostnames or credentials.

## Frontend package seams

The package exposes only the documented explicit frontend subpaths for hosts,
API modules, Sidebar, SettingsDialog, theme, and i18n. Facades emit JS and
declarations below `dist/frontend`, do not depend at runtime on `frontend/src`,
`$lib`, or generated private paths, and use declared Svelte/framework peers.
No wildcard barrel, private import, HiaiDocs alias in new code, or copied OSS
component is permitted.

Downstream pins exactly `@hiai-gg/docsmint: "0.3.2"`. Its private imports may
be removed only after the packed-tarball fixture resolves every new public
subpath and `check-ui-boundary.sh` exits zero.
