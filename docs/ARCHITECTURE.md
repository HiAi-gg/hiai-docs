# Architecture

## Monorepo Structure

```
hiai-docs/
├── backend/              # Elysia REST API (Bun runtime)
│   └── src/
│       ├── api/routes/   # Route handlers (documents, folders, search, share, tags, auth, metrics)
│       ├── api/middleware/# Auth, rate-limit middleware
│       ├── embedding/    # Embedding pipeline (chunker, providers, queue)
│       └── lib/          # Shared utilities
│           ├── redis-factory.ts  # Pure createRedis(cfg) factory — no config dependency
│           ├── minio-factory.ts   # Pure createMinio(cfg) + ensureBucket() factory
│           ├── redis.ts          # Singleton re-export wrapper (→ redis-factory)
│           ├── minio.ts          # Singleton re-export wrapper (→ minio-factory)
│           ├── with-tenant.ts    # Re-export shim → packages/db/src/with-tenant
│           └── metrics.ts        # In-process metrics registry
├── frontend/             # SvelteKit 2 + Svelte 5 + Tailwind CSS v4
│   └── src/
│       ├── routes/       # Pages (+page.svelte per route)
│       └── lib/
│           ├── components/ # UI components (sidebar, editor, cards)
│           ├── components/ui/ # shadcn-svelte primitives
│           └── api/      # API client functions
├── packages/db/          # Drizzle ORM schema + migrations (shared)
│   └── src/
│       ├── schema.ts     # Table definitions + relations
│       ├── client.ts     # Drizzle database client
│       └── with-tenant.ts # RLS client: withTenant, TenantContext, adminTenantContext, shareGuestTenantContext
└── docker-compose.yml    # Full stack deployment
```

### Module Boundaries & DI Factories

The `backend/src/lib/` directory uses a **factory pattern** that enables external consumers (e.g. `docsmint`) to reuse Redis and MinIO infrastructure **without coupling to hiai-docs' `.env` validation**:

| File | Purpose | For external use? |
|------|---------|-----------------|
| `redis-factory.ts` | Pure `createRedis(cfg: RedisConfig)` — no `config.ts` import | ✅ Yes — `@hiai-gg/hiai-docs/backend/lib/redis` |
| `minio-factory.ts` | Pure `createMinio(cfg: MinioConfig)` + `ensureBucket()` | ✅ Yes — `@hiai-gg/hiai-docs/backend/lib/minio` |
| `redis.ts` | Backwards-compatible singleton (calls factory with `config.REDIS_URL`) | Internal only |
| `minio.ts` | Backwards-compatible singletons (`minio`, `minioPublic`) | Internal only |
| `with-tenant.ts` | Thin re-export shim → `packages/db/src/with-tenant` | ✅ Yes — `@hiai-gg/hiai-docs/db/with-tenant` |
| `metrics.ts` | In-process embedding metrics registry | Internal only |

**npm subpath exports** (see `package.public.json` exports field):

```ts
// RLS-tenant-scoped queries (from shared package)
import { withTenant, adminTenantContext } from "@hiai-gg/hiai-docs/db/with-tenant";

// Pure factories — no hiai-docs config dependency
import { createRedis } from "@hiai-gg/hiai-docs/backend/lib/redis";
import { createMinio } from "@hiai-gg/hiai-docs/backend/lib/minio";

// Schema access
import { documents, folders } from "@hiai-gg/hiai-docs/schema";
```

The RLS tenant context (`with-tenant.ts`) lives in `packages/db/` so it can be shared across both the backend API and any external consumer that imports hiai-docs tables directly.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.3.14+ |
| Backend | Elysia 1.4.28+ |
| ORM | Drizzle 0.45.2+ |
| Database | PostgreSQL 18 + pgvector |
| Cache | Redis 8.6+ |
| Auth | Better Auth |
| Frontend | SvelteKit 2.60+ / Svelte 5.55+ |
| UI | shadcn-svelte (new-york) + Tailwind v4 |
| Editor | TipTap + svelte-tiptap |
| Embeddings | OpenAI-compatible API (optional) |
| Storage | MinIO (S3-compatible) |

## Data Flow

```
User → SvelteKit Frontend → REST API (Elysia) → PostgreSQL
                                              → Redis (queue/cache)
                                              → MinIO (attachments)
                                              → [Optional] Embedding API
```

1. User creates/edits document in TipTap editor
2. Frontend PATCHes document via API
3. API saves content + version to PostgreSQL
4. If embeddings are configured, API enqueues embedding job to Redis
5. Background worker fetches document, chunks text, generates vector via OpenAI-compatible API
6. Worker stores vector in pgvector column (if embeddings enabled)

Search queries run hybrid: full-text (tsvector) + semantic (pgvector cosine) when embeddings are configured. Without embeddings configured, only full-text search is available.

## Module Boundaries

- `api/` imports from `lib/` and `embedding/` — never the reverse
- `embedding/` imports from `lib/` only
- `lib/` has no imports from `api/` or `embedding/`
- `packages/db/` is imported by both backend and has no dependencies on either

## Security Model

- **Data isolation**: every query filters by `ownerId` (user-scoped)
- **Auth**: Better Auth session cookies (7-day expiry)
- **Sharing**: token-based links with optional password + expiry
- **Rate limiting**: 10 req/min per IP on public share endpoints
- **Validation**: Zod schemas on all API inputs
- **No secrets in code**: all config via environment variables
