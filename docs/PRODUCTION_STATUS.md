# Production Status Report

> **Status:** RELEASE CANDIDATE — pending GitHub CI and operator browser acceptance
> **Version:** v0.2.7
> **Last verified:** 2026-07-11

## Verified release evidence

| Check | Result |
|-------|--------|
| Backend tests | PASS — 577 passed / 0 failed |
| Frontend tests | PASS — 59 passed / 0 failed |
| Lint / typecheck / build / SDK build | PASS |
| Compose validation | PASS |
| Docker images | PASS — API, web, PostgreSQL/migration, and Caddy built locally |
| API health | PASS — in-container `/api/health` returned `status: ok` |
| Fresh database | PASS — migrations `0000–0026`, AGE graph labels, vector indexes, RLS |
| Upgraded database | PASS — v0.2.6 fixture preserved through current migrations |
| Live GraphRAG | PASS — Recall@10 1.0, MRR@10 1.0, cross-language 4/4 |
| GraphRAG data | PASS — 8 ready 1024-dim embeddings, 52 nodes, 92 edges |
| Tenant/security gates | PASS — invalid vectors 0, tenant leakage 0, explanation failures 0 |
| Clean npm consumer | CI gate — pack/install SDK, CLI, and MCP from the public manifest |
| Browser acceptance | OPERATOR — run manually at `http://localhost:57001` |
| Public release actions | NOT RUN — tag, push, npm/Docker publish, and GitHub Release remain explicit release steps |

The live latency gate passed in the serialized candidate run (fast p95 411ms,
expanded p95 2485ms). OpenRouter network/provider latency can vary, so CI and
release notes must retain the measured values rather than imply a universal SLA.

## Architecture

The search contour contains exact/title, multilingual lexical, fuzzy, vector,
adaptive expansion, and automatic GraphRAG channels. Reciprocal rank fusion
(RRF) combines candidates with exact-title and channel-agreement boosts. Graph
contribution is capped and graph failures degrade to direct results.

Embedding generations transition through `pending`, `processing`, `ready`,
`failed`, and `stale`. Only complete finite, non-zero 1024-dimensional
generations are queryable. A failed replacement never removes the last active
generation, and GraphRAG extraction runs only after activation.

Security includes rate limiting, Zod validation, owner/share scoping, CSRF
protection, CORS, security headers, tenant-scoped expansion cache keys, and
safe public result explanations without prompts, credentials, or tenant data.

## Deployment

```bash
git clone https://github.com/hiai-gg/hiai-docs.git && cd hiai-docs
cp .env.example .env
docker compose pull && docker compose up -d
bun run db:migrate
```

### Ports

| Port | Service |
|------|---------|
| 50700 | API |
| 50701 | Frontend |
| 5437 | PostgreSQL |
| 6384 | Redis |
| 9020 | SeaweedFS S3 |
| 80/443 | Caddy |

## Testing and release gates

Run `bun run test`, `bun run lint`, `bun run typecheck`, `bun run --filter '*'
build`, and `docker compose --env-file .env.example config --quiet` from the
repository root. Run the
generation-aware reindex dry-run and then:

```bash
cd backend && bun run benchmark:search -- --base-url=http://127.0.0.1:50700 --owner-credentials-file=/run/secrets/hiai-docs-benchmark-owners.json
```

The operator credential for admin metrics must be supplied through
`HIAI_DOCS_API_KEY` or `BENCHMARK_API_KEY` (environment, stdin, or a protected
file). Search probes use a separate owner-credential JSON map, for example:

```json
{
  "owner-a": { "authorization": "Bearer replace-with-owner-a-token" },
  "owner-b": { "cookie": "better-auth.session_token=replace-with-owner-b-session" }
}
```

Keep the map at `/run/secrets/hiai-docs-benchmark-owners.json` or another
protected path outside the repository. Do not pass an operator API key or
owner credential in argv (`--api-key=...` is rejected), because argv is
visible to process inspection and shell history. Record the exact counts,
latency percentiles, expansion coverage, graph contribution, invalid-vector
count, and tenant-leakage result in the release report.

## Release notes

- The browser acceptance gate is intentionally manual for this release. Start the
  local stack and verify `http://localhost:57001` before authorizing publication.
- No tag, GitHub release, npm publish, Docker push, or Git push has been
  performed by this verification contour.
- The reference PostgreSQL image includes the AGE and vector extensions required
  by the canonical migration journal. A plain upstream PostgreSQL image is not a
  supported production bootstrap.

GraphRAG is automatic in the reference profile and can be disabled only with
`GRAPH_SEARCH_ENABLED=false` as an operator kill switch.

---

*Status: RELEASE CANDIDATE — pending GitHub CI and operator acceptance*
