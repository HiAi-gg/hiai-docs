# hiai-docs

> **Your personal/team AI-ready knowledge vault.**
> Markdown + AI embeddings + simple sharing — without the bloat.

A modern, lightweight, self-hosted knowledge base with built-in vector embeddings, rich editing, and seamless AI integration.

---

## Features

- **Markdown-first** — Rich WYSIWYG editor (svelte-tiptap + TipTap v3) with raw Markdown toggle
- **AI-native** — Automatic chunking + vector embeddings on every save (RAG-ready)
- **Semantic search** — Hybrid full-text + pgvector search across your knowledge
- **Folder hierarchy** — Nested folders for organizing documents
- **Sharing** — Token-based links with password, expiration, and guest access
- **Import/Export** — Upload .md files, download documents as Markdown
- **Self-hosted** — Full data ownership, Docker deployment
- **Agent-ready** — Clean REST API for AI agent integration (Mastra compatible)

---

## Quick Start

### Docker (Production-style)

```bash
git clone https://github.com/hiai-gg/hiai-docs.git
cd hiai-docs
cp .env.example .env
# Edit .env with your settings

docker compose up -d
```

Open http://localhost:50701

### Local Development (Recommended for hacking)

Two equivalent workflows — pick one. Both give you live-reload at http://localhost:50701.

#### Option A — Hybrid (infra in Docker, api+web on host)

This is the fastest dev loop. `bun run dev` runs `vite dev` (port 50701) and `bun --watch` for the api in parallel; both auto-reload on file changes.

```bash
# 1. Install JS deps once
bun install

# 2. Start infrastructure in Docker
bun run docker:dev          # brings up postgres, redis, ollama, minio

# 3. Push DB schema (one-time, or after schema changes)
bun run db:push

# 4. Start api + web on the host, with live reload
bun run dev
# vite dev → http://localhost:50701
# api      → http://localhost:50700
```

Stop the infra when done: `bun run stop`

#### Option B — Full Docker with live-reload bind mounts

`docker-compose.dev.yml` mounts the source into the api/web containers, so editing a file on the host is picked up inside the container (vite HMR + bun --watch). Useful when you want everything isolated in Docker.

```bash
bun run docker:dev
# Open http://localhost:50701
```

> The `web` and `api` services in `docker-compose.dev.yml` bind `./:/app`, so any edit on the host is reflected inside the container without rebuilding.

### Why is port 50701 special?

The frontend dev server is pinned to port 50701 in `frontend/vite.config.ts` with `strictPort: true`. That last flag is important: if 50701 is already taken (e.g. a stale container from a previous run), vite will **fail loudly** instead of silently falling back to 5173 — which would leave you staring at an old build at http://localhost:50701. If you see "port 50701 in use", run `docker compose down` (or `bun run stop`) and retry.

### Troubleshooting

- **Port 50701 already in use** — `docker compose down` to stop stale containers, then retry `bun run dev` or `bun run docker:dev`.
- **Changes not showing up** — `bun run dev` already wires HMR. If running via Docker, confirm the bind mount is in `docker-compose.dev.yml` (not the prod `docker-compose.yml`, which builds an immutable image).
- **`bun install` complains about the lockfile** — ensure `bun.lock` is in sync: `bun install`.
- **Docker `web` build fails on `@inlang/sdk` / `NameTooLong`** — Handled in `frontend/Dockerfile` via a `sed` patch on `@inlang/sdk@0.37.0`'s `resolve-modules/import.js` (the SDK is pulled in by `@inlang/paraglide-sveltekit@0.16.1` and emits `data:` URLs that exceed bun's package-name length limit). The patch swaps in a `blob:` URL under `process.versions.bun`. Do not remove the patch block; it will be replaced when paraglide-sveltekit is bumped to `1.0.0` (breaking upgrade, not yet planned).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) 1.3.14+ |
| Backend | [Elysia](https://elysiajs.com) 1.4.28+ |
| ORM | [Drizzle ORM](https://orm.drizzle.team) 0.45.2+ |
| Database | [PostgreSQL](https://postgresql.org) 18 + [pgvector](https://github.com/pgvector/pgvector) |
| Cache | [Redis](https://redis.io) 8.6+ |
| Auth | [Better Auth](https://better-auth.com) |
| Frontend | [SvelteKit](https://kit.svelte.dev) 2.60+ |
| UI | [shadcn-svelte](https://shadcn-svelte.com) (new-york style) |
| Editor | [svelte-tiptap](https://github.com/sibiraj-s/svelte-tiptap) + [TipTap v3](https://tiptap.dev) |
| Embeddings | [Ollama](https://ollama.ai) (configurable) |
| Storage | [MinIO](https://min.io) (S3-compatible) |

---

## Project Structure

```
hiai-docs/
├── backend/              # Elysia REST API
│   ├── src/
│   │   ├── api/          # Routes + middleware
│   │   ├── lib/          # Shared utilities
│   │   ├── embedding/    # Embedding pipeline
│   │   └── index.ts      # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/             # SvelteKit web UI
│   ├── src/
│   │   ├── routes/       # Pages
│   │   ├── lib/          # Components + utils
│   │   └── app.css       # Tailwind + theme
│   ├── package.json
│   └── svelte.config.js
├── packages/db/          # Drizzle schema + migrations
│   ├── src/
│   │   ├── schema.ts     # Table definitions
│   │   ├── migrations/   # SQL migrations
│   │   └── index.ts      # DB client
│   └── package.json
├── docker-compose.yml    # Production Docker setup
├── .env.example          # Environment template
├── AGENTS.md             # Agent instructions
├── README.md             # This file
├── LICENSE               # MIT
└── todo.md               # Development roadmap
```

---

## Configuration

All configuration via environment variables. Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | aiuser | PostgreSQL username |
| `DB_PASSWORD` | changeme | PostgreSQL password |
| `BETTER_AUTH_SECRET` | — | Auth secret (generate random) |
| `BETTER_AUTH_URL` | http://localhost:50700 | Auth base URL |
| `MINIO_ACCESS_KEY` | minioadmin | MinIO access key |
| `MINIO_SECRET_KEY` | minioadmin | MinIO secret key |
| `EMBEDDING_PROVIDER` | ollama | Embedding provider (ollama/openrouter/voyage) |
| `EMBEDDING_MODEL` | nomic-embed-text | Embedding model name |
| `OPENROUTER_API_KEY` | — | OpenRouter API key (fallback) |

See `.env.example` for full list.

---

## API Documentation

REST API available at `http://localhost:50700/api/`.

Key endpoints:
- `POST /api/documents` — Create document
- `GET /api/documents/:id` — Get document
- `GET /api/search?q=query` — Hybrid search
- `POST /api/share` — Create share link
- `GET /api/share/:token` — Access shared content

Full API documentation available in [docs/API.md](docs/API.md).

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

### Development Rules

- **Bun only** — no npm/yarn
- **ESM only** — no CommonJS
- **TypeScript strict** — no `any`
- **English only** — code, comments, docs, commits
- **No Playwright** — use agent-browser for E2E

---

## License

[MIT](LICENSE)

---

## Related Projects

| Project | Description |
|---------|-------------|
| [hiai-kit](../hiai-kit) | AI agent starter kit |
| [hiai-store](../hiai-store) | Multi-tenant e-commerce |
| [hiai-admin](../hiai-admin) | Platform admin panel |
| [hiai-post](../hiai-post) | Social media management |
| [hiai-observe](../hiai-observe) | Observability platform |
| [hiai-amigo](../hiai-amigo) | Telegram AI bot |
