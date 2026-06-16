# Strategic Plan — hiai-docs

> **Project:** hiai-docs (AI-native knowledge base)
> **Status:** ✅ Production-ready (Phase 0-7 complete)
> **Next phase:** Phase 8 (Pre-production)
> **Last updated:** 2026-06-14

This document outlines the complete strategic roadmap for hiai-docs beyond the initial 8-phase development plan. It covers pre-production hardening, post-launch improvements, advanced features, testing, documentation, DevOps, and long-term vision.

---

## Table of Contents

1. [Current Status](#current-status)
2. [Roadmap Overview](#roadmap-overview)
3. [Phase 8: Pre-production (1-2 weeks)](#phase-8-pre-production-1-2-weeks)
4. [Phase 9: Post-Launch Improvements (1 month)](#phase-9-post-launch-improvements-1-month)
5. [Phase 10: Advanced Features (2-3 months)](#phase-10-advanced-features-2-3-months)
6. [Phase 11: Long-Term Vision (6+ months)](#phase-11-long-term-vision-6-months)
7. [Task Registry](#task-registry)
8. [Risk Register](#risk-register)
9. [Decision Log](#decision-log)

---

## Current Status

### What Works Today

| Domain | Status | Details |
|--------|--------|---------|
| Backend API | ✅ Complete | 9 route files, Zod validation, auth, rate limiting |
| Database | ✅ Complete | 12 tables, proper indexing (GIN, HNSW, B-tree) |
| Embedding Pipeline | ✅ Complete | Chunker, provider abstraction, queue, fallback |
| Frontend Pages | ✅ Complete | Dashboard, editor, folder browser, search, settings |
| Shared Content | ✅ Complete | Token-based public viewer with password + expiry |
| Version History | ✅ Complete | Snapshot on PATCH, diff view, restore |
| Docker | ✅ Complete | Multi-stage builds, non-root, healthchecks |
| Documentation | ✅ Complete | README, AGENTS.md, API.md, DEPLOYMENT.md, PRODUCTION_STATUS.md |

### Verification Results

| Check | Result |
|-------|--------|
| **Typecheck** | ✅ 0 errors, 0 warnings (3 packages) |
| **Tests** | ✅ 178/178 passing (152 backend + 26 frontend) |
| **Lint (backend)** | ✅ Clean |
| **Lint (frontend)** | ⚠️ 44 errors + 298 warnings (Biome Svelte 5 false positives) |
| **Build** | ✅ Docker multi-stage builds pass |

### Known Gaps (Pre-Deployment)

- Database migrations not generated (currently using `db:push`)
- `OPENROUTER_API_KEY` is a placeholder
- Dev-only secrets need regeneration
- Default MinIO/PostgreSQL credentials unchanged
- No E2E browser tests
- No automated backups
- Caddy TLS not configured for production domain
- No error tracking / observability wired

---

## Roadmap Overview

```
Phase 8 (Pre-production)      ████████████░░░░░░░░  1-2 weeks
Phase 9 (Post-launch)         ██░░░░░░░░░░░░░░░░░░  1 month
Phase 10 (Advanced Features)  █░░░░░░░░░░░░░░░░░░░  2-3 months
Phase 11 (Long-Term Vision)   ░░░░░░░░░░░░░░░░░░░░  6+ months
```

### Dependencies Between Phases

```
Phase 8 ──→ Phase 9 ──→ Phase 10 ──→ Phase 11
  │            │            │
  │            ├── Testing improvements
  │            └── Documentation
  │
  ├── Lint cleanup (parallel)
  └── DevOps (ongoing, spans 9-11)
```

---

## Phase 8: Pre-production (1-2 weeks)

### Objective

Harden the application for production deployment. No new features — only reliability, security, and operational readiness.

### Task 8.1: Generate Database Migrations

| Attribute | Value |
|-----------|-------|
| **Priority** | Critical |
| **Description** | Replace `db:push` with versioned SQL migrations. This ensures schema changes are reproducible, reviewable in PRs, and reversible. |
| **Acceptance Criteria** | 1. `bun run db:generate` produces SQL migration files in `packages/db/src/migrations/`<br>2. `bun run db:migrate` applies migrations cleanly<br>3. `bun run db:push` is marked as dev-only in docs<br>4. Migration rolls back correctly (`bun run db:rollback`) |
| **Effort** | S |
| **Dependencies** | None |
| **Risk** | Low — Drizzle migration tooling is mature. Risk of column-type mismatches if schema has drifted from the database state. |
| **Commands** | `cd packages/db && bun run db:generate && bun run db:migrate` |

### Task 8.2: Configure OPENROUTER_API_KEY

| Attribute | Value |
|-----------|-------|
| **Priority** | Critical |
| **Description** | Replace the placeholder `OPENROUTER_API_KEY` with a real key from [openrouter.ai](https://openrouter.ai/keys). This enables fallback embeddings when Ollama is unavailable and unlocks alternative embedding providers. |
| **Acceptance Criteria** | 1. Valid OpenRouter API key set in `.env`<br>2. Fallback embedding path tested (e.g., stop Ollama, create a document, verify embedding succeeds)<br>3. Rate limits / billing understood |
| **Effort** | S |
| **Dependencies** | None |
| **Risk** | Low. OpenRouter provides a generous free tier. Key management (rotation, scoping) should follow best practices. |

### Task 8.3: Regenerate Production Secrets

| Attribute | Value |
|-----------|-------|
| **Priority** | Critical |
| **Description** | Generate fresh cryptographic secrets for all security-sensitive environment variables. Dev-only values must never reach production. |
| **Acceptance Criteria** | 1. All 4 secrets regenerated: `BETTER_AUTH_SECRET`, `CSRF_SECRET`, `WEBHOOK_SECRET`, `HIAI_DOCS_API_KEY`<br>2. Secrets injected via secure mechanism (Docker secrets, vault, or env file with restricted permissions)<br>3. Old dev secrets rotated / invalidated |
| **Effort** | S |
| **Dependencies** | None |
| **Risk** | Low. Risk of forgetting to update all environments (staging, production). |
| **Commands** | `openssl rand -hex 32` (run 4 times) |

### Task 8.4: Change Default Credentials

| Attribute | Value |
|-----------|-------|
| **Priority** | Critical |
| **Description** | Replace default MinIO (`minioadmin`/`minioadmin`) and PostgreSQL (`aiuser`/`changeme`) credentials with strong, unique values. |
| **Acceptance Criteria** | 1. MinIO access key and secret key changed<br>2. PostgreSQL user and password changed<br>3. Both services functional with new credentials<br>4. Old credentials invalidated |
| **Effort** | S |
| **Dependencies** | Task 8.3 (secrets management flow) |
| **Risk** | Low. Must update `docker-compose.yml` and `.env` consistently. |

### Task 8.5: E2E Testing via agent-browser

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Implement browser-based smoke tests using `agent-browser` (the approved E2E tool — no Playwright). Cover critical user journeys. |
| **Acceptance Criteria** | 1. Sign up → sign in → create folder → create document → edit → search — all succeed<br>2. Create share link → open in incognito → password prompt → content renders<br>3. Edit document → view version history → restore version<br>4. Test script is repeatable and checked into `scripts/e2e/`<br>5. At least one failure mode tested (e.g., invalid share token shows error) |
| **Effort** | M |
| **Dependencies** | Docker stack running with production config |
| **Risk** | Medium. `agent-browser` is a newer tool; headless Chromium behavior may differ from real browser. Flaky tests are common with browser automation. |
| **References** | `todo.md` T6.3 |

### Task 8.6: Configure TLS/HTTPS (Caddy)

| Attribute | Value |
|-----------|-------|
| **Priority** | Critical |
| **Description** | Replace the localhost-only Caddy configuration with production-ready TLS for the target domain. Ensure automatic Let's Encrypt certificate provisioning works. |
| **Acceptance Criteria** | 1. `Caddyfile` configured with real domain<br>2. HTTPS works (valid certificate, no browser warnings)<br>3. HTTP → HTTPS redirect works<br>4. CSP and HSTS headers are production-hardened<br>5. Certificate auto-renewal confirmed |
| **Effort** | S |
| **Dependencies** | DNS configured for target domain, ports 80/443 open |
| **Risk** | Low for basic TLS. Medium if behind a CDN or reverse proxy (Caddy configuration gets more complex). |

### Task 8.7: Set Up Automated Backups

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Implement nightly backup routines for PostgreSQL (pg_dump) and MinIO (mirror to remote storage). Includes a documented restore procedure. |
| **Acceptance Criteria** | 1. `scripts/backup.sh` exists and is executable<br>2. Nightly cron job installed (e.g., `0 3 * * *`)<br>3. Backups are stored off-machine (S3, B2, or SSH remote)<br>4. Restore procedure documented and tested<br>5. Backup integrity verified (checksums, dry-run restore) |
| **Effort** | M |
| **Dependencies** | Remote storage configured, SSH keys or API credentials set up |
| **Risk** | Medium. Backup scripts that silently fail are worse than no backups. Monitoring of backup success is essential. |

### Task 8.8: Document Deployment Process

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Write a comprehensive deployment runbook covering first-time setup, updates, rollback, and disaster recovery. |
| **Acceptance Criteria** | 1. Step-by-step first-time setup documented<br>2. Update procedure documented (git pull, rebuild, migrate)<br>3. Rollback procedure documented (database rollback, container rollback)<br>4. Disaster recovery documented (from backup)<br>5. Monitoring and alerting setup documented |
| **Effort** | S |
| **Dependencies** | Tasks 8.1-8.7 complete (so docs reflect reality) |
| **Risk** | Low. Documentation drift is the only risk. |

### Task 8.9: Dependency Audit

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Run `bun audit` and manually review dependencies for known vulnerabilities. Address any high/critical findings. |
| **Acceptance Criteria** | 1. `bun audit` output reviewed<br>2. No high/critical vulnerabilities remain unaddressed<br>3. Dependencies with known issues are pinned, patched, or replaced<br>4. Audit is repeatable (CI job) |
| **Effort** | S |
| **Dependencies** | None |
| **Risk** | Low. Bun's audit is mature. |

---

## Phase 9: Post-Launch Improvements (1 month)

### Objective

Polish, stabilize, and operationalize the application after initial deployment. Fix known issues, add missing features, and prepare for growth.

### Task 9.1: Frontend Lint Cleanup

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Address the 44 Biome errors and 298 warnings in the frontend. These are all false positives from Svelte 5 template scope handling, but they obscure real issues. |
| **Acceptance Criteria** | **Option A:** Configure `biome.json` to understand Svelte 5 runes (if upstream support added)<br>**Option B:** Add `// biome-ignore` comments at all noisy sites<br>**Option C:** Switch to `eslint-plugin-svelte` for frontend linting<br>**Option D:** Accept noise, document rationale in AGENTS.md |
| **Effort** | M (Option C), S (Options B/D) |
| **Dependencies** | Upstream Biome Svelte 5 support (for Option A) |
| **Risk** | Low. No runtime impact regardless of choice. |

### Task 9.2: Real-Time Collaboration Testing

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | The Yjs-based WebSocket real-time collaboration is already implemented. Test it thoroughly: multi-user editing, conflict resolution, cursor awareness, and reconnection handling. |
| **Acceptance Criteria** | 1. Two users editing the same document see each other's changes in real time<br>2. Concurrent edits merge correctly (Yjs CRDT algorithm verified)<br>3. Disconnecting and reconnecting syncs state correctly<br>4. Cursor position awareness works<br>5. Performance with 5+ concurrent editors is acceptable |
| **Effort** | M |
| **Dependencies** | Deployed production environment |
| **Risk** | Medium. WebSocket scalability under load. Cursor sync can be bandwidth-intensive. May need to implement awareness throttling. |

### Task 9.3: Performance Monitoring

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Set up infrastructure for monitoring application performance: API response times, database query performance, embedding pipeline latency, and frontend rendering. |
| **Acceptance Criteria** | 1. API response times tracked (p50, p95, p99)<br>2. Slow database queries identified via PostgreSQL `pg_stat_statements`<br>3. Embedding pipeline latency tracked (chunk → embed → store)<br>4. Frontend Web Vitals tracked (LCP, CLS, INP)<br>5. Baseline performance metrics recorded for regression detection |
| **Effort** | M |
| **Dependencies** | Task 9.7 (DevOps — monitoring stack) |
| **Risk** | Low. Overhead from instrumentation is minimal. Risk of alert fatigue if thresholds are set too aggressively. |

### Task 9.4: User Analytics

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Implement privacy-respecting user analytics to understand feature adoption, usage patterns, and churn signals. |
| **Acceptance Criteria** | 1. Track key events: sign-up, document create, search, share, version restore<br>2. Dashboard showing DAU/MAU, document growth, search volume<br>3. No PII collected (or anonymized)<br>4. Opt-out mechanism available<br>5. Self-hosted analytics preferred (Plausible, Umami, or similar) |
| **Effort** | M |
| **Dependencies** | None |
| **Risk** | Low. Privacy regulations (GDPR) must be considered if analytics are enabled by default. |

### Task 9.5: API Rate Limiting Per User

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Augment the existing IP-based rate limiting with per-user rate limits. This prevents a single authenticated user from degrading service for others. |
| **Acceptance Criteria** | 1. Per-user rate limits implemented for all authenticated routes<br>2. Rate limit headers sent in API responses (`X-RateLimit-*`)<br>3. Rate limit exceeded response includes retry-after<br>4. Configuration via `.env` (defaults: 100 req/min per user)<br>5. Admin users exempt or have higher limits |
| **Effort** | S |
| **Dependencies** | Better Auth session middleware |
| **Risk** | Low. Redis-backed sliding window is already implemented for IP — extending to user is straightforward. |

### Task 9.6: Audit Log

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Implement a comprehensive audit log tracking all state-changing operations: document creates/updates/deletes, share link creation, folder moves, user management. |
| **Acceptance Criteria** | 1. All state-changing operations logged (actor, action, resource, timestamp, metadata)<br>2. Audit log queryable via API<br>3. Audit log retained for configurable period<br>4. Audit log is append-only (tamper-evident)<br>5. Admin UI for browsing audit log |
| **Effort** | M |
| **Dependencies** | Better Auth admin roles (needs scoping) |
| **Risk** | Low. Storage growth is predictable. Risk of performance impact if audit writes are synchronous — use background queue. |

### Task 9.7: Webhook Notifications

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Implement outbound webhooks for external integrations. Allow users to subscribe to events (document created, updated, deleted, shared) and receive HTTP callbacks. |
| **Acceptance Criteria** | 1. Webhook registration UI (URL, events, secret)<br>2. Reliable delivery with retry + backoff<br>3. Webhook signing (HMAC-SHA256)<br>4. Delivery logs visible in UI<br>5. Rate-limited to prevent abuse |
| **Effort** | M |
| **Dependencies** | Task 9.6 (audit log event infrastructure) |
| **Risk** | Medium. Webhooks introduce external dependencies and failure modes (downstream services unresponsive). Must implement circuit breaker and dead-letter queue. |

### Task 9.8: Integration Tests

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Expand test coverage with integration tests that exercise the full stack: API → database → embedding pipeline → search. |
| **Acceptance Criteria** | 1. Document CRUD integration tests (create with embedding, update with version, delete with cleanup)<br>2. Search integration tests (hybrid search returns expected results)<br>3. Share link lifecycle (create, access, expire, delete)<br>4. Folder tree operations (create, move, delete with cascade)<br>5. All integration tests run in CI with a real PostgreSQL+pgvector test database |
| **Effort** | M |
| **Dependencies** | Docker Compose (for test database) |
| **Risk** | Low. Integration tests are slower but more valuable than unit tests. Risk of test pollution if test data is not isolated per test. |

### Task 9.9: Security Audit (OWASP)

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Conduct a systematic security audit following the OWASP Top 10 and ASVS (Application Security Verification Standard). |
| **Acceptance Criteria** | 1. OWASP Top 10 assessed for each attack category<br>2. OWASP ASVS Level 1 verified<br>3. Automated security scanning (ZAP, or similar)<br>4. Manual penetration testing of critical paths<br>5. Findings documented and triaged with remediation plan |
| **Effort** | L |
| **Dependencies** | Deployment accessible, test accounts available |
| **Risk** | Medium. Manual security testing requires expertise. Automated scanners produce false positives that must be triaged. |

### Task 9.10: Documentation Expansion

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Create comprehensive user-facing and operator-facing documentation beyond the technical API docs. |
| **Acceptance Criteria** | 1. User guide: creating documents, organizing with folders/tags, sharing, version history<br>2. Admin guide: configuration, deployment, user management, backup/restore<br>3. API examples: comprehensive examples with curl and JavaScript<br>4. Troubleshooting guide: common issues and their resolution<br>5. Performance tuning guide: database optimization, caching, scaling |
| **Effort** | L |
| **Dependencies** | Tasks 8.8 (deployment docs) |
| **Risk** | Low. Documentation maintenance is an ongoing effort. |

---

## Phase 10: Advanced Features (2-3 months)

### Objective

Add significant new capabilities that transform hiai-docs from a knowledge base into a platform. These features target power users, teams, and enterprise adoption.

### Task 10.1: Multi-Tenancy Support

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Activate the reserved `tenant_id` column to support multi-tenant deployments. Each tenant (organization, team, workspace) gets isolated data within a shared database. |
| **Acceptance Criteria** | 1. `tenant_id` column populated on all relevant tables<br>2. Middleware extracts tenant from hostname, subdomain, or header<br>3. All queries scoped to tenant (existing `owner_id` scoping is nested within tenant)<br>4. Tenant management API (create, suspend, delete)<br>5. Tenant-level configuration (custom branding, auth providers)<br>6. Data isolation verified — Tenant A cannot access Tenant B data |
| **Effort** | XL |
| **Dependencies** | Tasks 9.6 (audit log — needs tenant context) |
| **Risk** | High. Multi-tenancy is a cross-cutting concern that touches every query, middleware, and API handler. Schema migration for existing single-tenant deployments needs careful handling. Performance impact of an additional `WHERE tenant_id = $1` clause is minimal but must be verified. |

### Task 10.2: Advanced Search Filters

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Extend search with structured filters: date range, tags, folders, document type, author. Build a search query builder UI. |
| **Acceptance Criteria** | 1. Date range filter (created_at, updated_at)<br>2. Tag filter (AND/OR logic)<br>3. Folder filter (include subfolders)<br>4. Author / owner filter<br>5. Filter combination works correctly<br>6. Search result count / pagination<br>7. Query builder UI with visual filter chips |
| **Effort** | L |
| **Dependencies** | Search route in backend, search UI in frontend |
| **Risk** | Low-Medium. Query performance with multiple filters needs optimization (composite indexes). Complex filter UIs can be confusing. |

### Task 10.3: Document Templates

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Allow users to create and use document templates. Templates define a starting structure (sections, placeholders, metadata defaults) for new documents. |
| **Acceptance Criteria** | 1. Create template from existing document<br>2. Apply template when creating new document<br>3. Template management (list, edit, delete)<br>4. Template variables / placeholders (e.g., `{{date}}`, `{{author}}`)<br>5. Shared team templates (with tenant scoping) |
| **Effort** | M |
| **Dependencies** | Document CRUD |
| **Risk** | Low. Templates are essentially documents with a special flag. Complexity is in the template variable system and UI. |

### Task 10.4: Export to PDF / HTML / PNG

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Implement document export to multiple formats: PDF (print-ready), HTML (self-contained webpage), PNG (screenshot/image). |
| **Acceptance Criteria** | 1. Export to PDF with proper styling (headers, code blocks, images)<br>2. Export to HTML (single file, embedded CSS)<br>3. Export to PNG (full page image)<br>4. Batch export for multiple documents<br>5. Export via API (for integrations) |
| **Effort** | L |
| **Dependencies** | Document rendering pipeline |
| **Risk** | Medium. PDF generation is notoriously tricky (page breaks, Unicode, long content). Consider using an existing service or `projects/docsexport` if available. |

### Task 10.5: Bulk Operations

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Enable bulk operations on documents: import, export, delete, move between folders, tag/unTag. |
| **Acceptance Criteria** | 1. Bulk import: upload multiple .md files at once<br>2. Bulk export: download multiple documents as ZIP<br>3. Bulk delete with confirmation and undo window<br>4. Bulk move between folders<br>5. Bulk tag / untag<br>6. Progress indicator for long-running operations |
| **Effort** | M |
| **Dependencies** | Task 10.4 (export) |
| **Risk** | Medium. Bulk operations must be transactional (all succeed or all roll back). Long-running operations need background job queue. |

### Task 10.6: Tags Improvements (Hierarchical, Colors)

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Enhance the tag system with hierarchical tags (parent/child), color coding, and tag groups. |
| **Acceptance Criteria** | 1. Nested/hierarchical tags (e.g., `programming/frontend/react`)<br>2. Tag color assignment (16-color palette)<br>3. Tag groups / namespaces<br>4. Auto-complete when adding tags to documents<br>5. Filter by tag hierarchy (show all children) |
| **Effort** | M |
| **Dependencies** | Tag database schema (currently flat) |
| **Risk** | Medium. Schema migration for hierarchical tags needs careful design. Existing tags must be migrated. |

### Task 10.7: Folder Permissions (Shared Folders)

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Allow sharing entire folders with other users (or teams) with configurable permissions: view, edit, admin. |
| **Acceptance Criteria** | 1. Share folder with specific users<br>2. Permission levels: view, edit, admin<br>3. Inherited permissions (subfolders inherit from parent)<br>4. Visual indicator for shared folders<br>5. Permission audit trail |
| **Effort** | M |
| **Dependencies** | Task 10.1 (multi-tenancy) — folder permissions are much simpler with multi-tenant isolation |
| **Risk** | Medium. Permission inheritance is complex. Edge cases: user removed from folder access, circular permission chains. |

### Task 10.8: Version History Improvements

| Attribute | Value |
|-----------|-------|
| **Priority** | Medium |
| **Description** | Enhance the version history feature with visual diff (side-by-side or inline), meaningful version naming, and one-click restore. |
| **Acceptance Criteria** | 1. Visual diff: side-by-side and inline views<br>2. Version naming (auto-generated from first line change)<br>3. Version comparison (select two versions and diff)<br>4. One-click restore with confirmation<br>5. Version pruning (auto-delete old versions after configurable threshold) |
| **Effort** | M |
| **Dependencies** | Version history route (existing), diff library |
| **Risk** | Low. Visual diff is a solved problem. Risk of performance issues with very large documents (many versions). |

### Task 10.9: Performance Tests

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Establish performance benchmarks and conduct load tests to ensure the application handles expected traffic. |
| **Acceptance Criteria** | 1. Baseline performance metrics established (API response times, DB query times)<br>2. Load test with 100 concurrent users<br>3. Load test with 10k documents and 1M chunks<br>4. Search performance with 100k chunks<br>5. Report with recommendations for bottlenecks |
| **Effort** | M |
| **Dependencies** | Task 9.3 (performance monitoring) |
| **Risk** | Low. Performance testing is non-destructive. May identify bottlenecks requiring significant refactoring. |

### Task 10.10: Load Testing

| Attribute | Value |
|-----------|-------|
| **Priority** | High |
| **Description** | Conduct systematic load testing using tools like k6, Locust, or artillery. Identify breaking points and plan capacity. |
| **Acceptance Criteria** | 1. Sustained load of 50 req/s for 5 minutes<br>2. Peak load of 200 req/s for 30 seconds<br>3. Graceful degradation under load (rate limiting, queuing)<br>4. Recovery after load spike<br>5. Report with scaling recommendations |
| **Effort** | M |
| **Dependencies** | Task 10.9 (performance tests) |
| **Risk** | Low. Load testing requires careful monitoring to avoid impacting production (use staging). |

---

## Phase 11: Long-Term Vision (6+ months)

### Objective

Transform hiai-docs into a full platform with mobile access, third-party integrations, plugin ecosystem, and AI-powered features.

### Task 11.1: Mobile App (Flutter 3.44+)

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Build a mobile companion app using Flutter 3.44+ for reading, searching, and creating documents on the go. |
| **Acceptance Criteria** | 1. Read documents offline (sync-once pattern)<br>2. Search across all documents<br>3. Create and edit documents<br>4. Push notifications for shared documents<br>5. Biometric authentication (Face ID / fingerprint)<br>6. Dark mode and accessibility features |
| **Effort** | XL |
| **Dependencies** | Public API (Task 11.4) |
| **Risk** | High. Mobile development is a significant investment. Two codebases (iOS + Android) increase maintenance burden. Flutter mitigates this but introduces its own complexities. |

### Task 11.2: Desktop App (Tauri or Electron)

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Build a desktop application for offline-heavy use, local file system integration, and native OS features (menus, notifications, system tray). |
| **Acceptance Criteria** | 1. Offline document editing with sync<br>2. Local file system integration (import/export, drag-and-drop)<br>3. System tray with quick search<br>4. Native notifications<br>5. Auto-updater |
| **Effort** | XL |
| **Dependencies** | Public API (Task 11.4) |
| **Risk** | High. Desktop apps add a third platform to maintain. Tauri (Rust-based) is preferred over Electron for performance and bundle size. |

### Task 11.3: Browser Extension

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Build a browser extension that allows users to clip web content directly into hiai-docs, search from the browser, and get AI-powered summaries of saved pages. |
| **Acceptance Criteria** | 1. Right-click → "Save to hiai-docs" context menu<br>2. Browser action popup with quick search<br>3. Auto-extract title, content, and metadata from saved pages<br>4. Save with tags and folder<br>5. Supported on Chrome, Firefox, and Edge |
| **Effort** | L |
| **Dependencies** | Public API (Task 11.4) |
| **Risk** | Medium. Cross-browser compatibility issues. Extension review processes vary by browser store. |

### Task 11.4: Public API for Third-Party Integrations

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Expose a well-documented, versioned public API (v1) for third-party developers. Include rate limiting, API key management, webhooks, and comprehensive SDKs. |
| **Acceptance Criteria** | 1. Versioned REST API (v1) with OpenAPI 3.1 spec<br>2. API key management UI (create, revoke, scope)<br>3. Rate limiting per API key<br>4. SDK in TypeScript / Python<br>5. Developer portal with interactive docs (Scalar or Stoplight)<br>6. Usage dashboard for API consumers |
| **Effort** | XL |
| **Dependencies** | All existing API routes need versioning and stabilization |
| **Risk** | High. Public API is a contract — breaking changes must be managed with versioning and deprecation notices. Security surface area increases significantly. |

### Task 11.5: Plugin System

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Design and implement a plugin system allowing third-party developers to extend hiai-docs functionality: custom blocks, integrations, themes, and automation. |
| **Acceptance Criteria** | 1. Plugin manifest format (metadata, permissions, entry points)<br>2. Plugin lifecycle (install, activate, deactivate, uninstall)<br>3. Plugin API (hooks for document save, search, render)<br>4. Sandboxed execution (no access to host system)<br>5. Plugin marketplace UI |
| **Effort** | XL |
| **Dependencies** | Task 11.4 (public API) |
| **Risk** | Very High. Plugin systems are extremely complex — sandboxing, versioning, security, and API stability all need careful design. This is a year-long effort for a mature product. |

### Task 11.6: Marketplace

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Create a marketplace for themes, templates, plugins, and integrations. Allow community contributions and curation. |
| **Acceptance Criteria** | 1. Browse and search available extensions<br>2. One-click install from marketplace<br>3. Version management (compatible hiai-docs versions)<br>4. Rating and reviews<br>5. Developer submission pipeline |
| **Effort** | XL |
| **Dependencies** | Task 11.5 (plugin system) |
| **Risk** | Very High. Marketplace requires moderation, legal review, and infrastructure for package distribution. |

### Task 11.7: AI-Powered Features

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Enhance the application with AI capabilities beyond embeddings: auto-tagging, document summarization, related document recommendations, and AI-assisted writing. |
| **Acceptance Criteria** | 1. **Auto-tagging:** AI suggests tags when creating/updating documents<br>2. **Summarization:** Generate document summaries (extractive and abstractive)<br>3. **Related documents:** AI-powered recommendations based on content similarity<br>4. **AI writing assistant:** Inline suggestions, completion, and rewriting<br>5. **Question answering:** Ask questions about your knowledge base |
| **Effort** | XL |
| **Dependencies** | LLM provider integration, embedding pipeline |
| **Risk** | Medium. AI features depend on LLM quality and latency. Cost management is essential (OpenRouter API costs). User trust and accuracy concerns must be addressed. |

### Task 11.8: Collaborative Editing Improvements

| Attribute | Value |
|-----------|-------|
| **Priority** | Low |
| **Description** | Enhance real-time collaborative editing beyond basic Yjs sync: comments, suggestions/track changes, presence indicators, and activity feeds. |
| **Acceptance Criteria** | 1. Inline comments (select text → comment)<br>2. Suggestions / track changes (accept/reject)<br>3. Rich presence indicators (typing, selecting)<br>4. Document activity feed (who changed what and when)<br>5. @mentions with notifications |
| **Effort** | XL |
| **Dependencies** | Task 9.2 (collaboration testing), Yjs provider |
| **Risk** | Medium-High. Collaborative features are complex to implement correctly. Edge cases around conflict resolution, comment anchoring (when text changes), and notification delivery. |

---

## Task Registry

### Summary by Phase

| Phase | Tasks | Critical | High | Medium | Low | Effort (S/M/L/XL) |
|-------|-------|----------|------|--------|-----|--------------------|
| 8 | 9 | 4 | 4 | 0 | 0 | 6S / 3M / 0L / 0XL |
| 9 | 10 | 0 | 4 | 6 | 0 | 2S / 4M / 3L / 0XL |
| 10 | 10 | 0 | 2 | 8 | 0 | 0S / 5M / 4L / 1XL |
| 11 | 8 | 0 | 0 | 0 | 8 | 0S / 0M / 1L / 7XL |
| **Total** | **37** | **4** | **10** | **14** | **8** | **8S / 12M / 8L / 8XL** |

### Priority Distribution

```
Critical: ████████████░░░░░░  4 tasks (11%)
High:     ████████████████████░░░░  10 tasks (27%)
Medium:   ████████████████████████████░░  14 tasks (38%)
Low:      █████████████████░░░  8 tasks (22%)
```

### Effort Distribution

```
S:  ████████████████████░░░░░░░░  8 tasks (22%)
M:  ████████████████████████████░░  12 tasks (32%)
L:  ████████████████████░░░░░░░░  8 tasks (22%)
XL: ████████████████████░░░░░░░░  8 tasks (22%)
```

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| R1 | Database migration failure in production | Low | Critical | Test migrations on staging first; always have rollback plan | DevOps |
| R2 | OpenRouter API key leak / rate limit | Medium | High | Use restricted-scope keys; monitor usage; implement key rotation | Security |
| R3 | Backup script silently fails | Medium | Critical | Monitor backup job output; periodic restore drills | DevOps |
| R4 | E2E tests flaky / unreliable | Medium | Medium | Use retry logic; isolate test state; run in CI with screenshots on failure | QA |
| R5 | Multi-tenancy schema migration breaks existing data | Low | Critical | Run migration in transaction; test on copy of production data | Backend |
| R6 | Public API breaking changes anger developers | Medium | High | Semantic versioning; deprecation notices; migration guides | Backend |
| R7 | Plugin security (XSS, data exfiltration) | Medium | Critical | Sandbox execution; permission system; code review | Security |
| R8 | LLM costs for AI features exceed budget | Medium | Medium | Cost tracking; user quotas; caching | Product |
| R9 | WebSocket collaboration performance degrades | Low | Medium | Awareness throttling; connection pooling; load testing | Backend |
| R10 | Single developer bus factor | High | High | Documentation; code review; knowledge sharing | All |

### Risk Trend

```
Phase 8:  ████████░░  Risk: Operational (backups, secrets, TLS)
Phase 9:  ██████░░░░  Risk: Stabilization (monitoring, security audit)
Phase 10: ████████░░  Risk: Architectural (multi-tenancy, permissions)
Phase 11: ██████████  Risk: Strategic (plugin security, mobile complexity)
```

---

## Decision Log

### Decision 1: No Playwright — Use agent-browser

| Attribute | Value |
|-----------|-------|
| **Date** | 2026-06-14 |
| **Context** | The monorepo AGENTS.md forbids Playwright. All browser automation must use `agent-browser`. |
| **Decision** | All E2E tests (Task 8.5) will use `agent-browser` CLI. |
| **Consequences** | Positive: aligns with workspace policy. Negative: smaller community, fewer examples, need to build test infrastructure from scratch. |

### Decision 2: Yjs for Real-Time Collaboration (Already Implemented)

| Attribute | Value |
|-----------|-------|
| **Date** | 2026-06-14 |
| **Context** | Need real-time collaborative editing. Options: Yjs (CRDT), CKEditor, Slate. |
| **Decision** | Yjs was already chosen and implemented during Phase 3. |
| **Consequences** | Positive: CRDT provides conflict-free resolution, no central server needed for merge logic. Negative: Requires WebSocket infrastructure, awareness sync can be bandwidth-heavy. |

### Decision 3: Biome for Linting (Despite False Positives)

| Attribute | Value |
|-----------|-------|
| **Date** | 2026-06-14 |
| **Context** | Biome reports 44 false positive errors in Svelte 5 templates. |
| **Decision** | Current: Accept noise, use typecheck as source of truth (Task 9.1). Future: Re-evaluate when Biome adds Svelte 5 support, or switch to eslint-plugin-svelte. |
| **Consequences** | Positive: No tooling migration cost. Negative: Lint output is noisy; real errors could be hidden in the noise. |

### Decision 4: pgvector HNSW Index for Embeddings

| Attribute | Value |
|-----------|-------|
| **Date** | 2026-06-14 |
| **Context** | Need sub-linear semantic search across embedding vectors. Options: HNSW (pgvector), IVFFlat (pgvector), external vector DB. |
| **Decision** | HNSW index for pgvector (already implemented). |
| **Consequences** | Positive: Fast search, no external service. Negative: HNSW build time is O(n log n), memory-intensive for very large datasets. Acceptable for expected scale. |

### Decision 5: OpenRouter as Fallback Embedding Provider

| Attribute | Value |
|-----------|-------|
| **Date** | 2026-06-14 |
| **Context** | Need a reliable embedding fallback when Ollama is unavailable. |
| **Decision** | OpenRouter as the fallback provider. Voyage as an alternative option. |
| **Consequences** | Positive: Multiple model options, no vendor lock-in. Negative: Requires API key management, introduces external dependency for a core feature. |

---

## Appendix: Quick Reference

### Phase 8 Checklist (Pre-Deployment)

```
Critical (must do before going live):
- [ ] 8.1 Generate database migrations (bun run db:generate)
- [ ] 8.2 Set real OPENROUTER_API_KEY
- [ ] 8.3 Regenerate all production secrets
- [ ] 8.4 Change default MinIO and PostgreSQL credentials
- [ ] 8.6 Configure TLS/HTTPS for production domain

High (do before or immediately after launch):
- [ ] 8.5 E2E testing via agent-browser
- [ ] 8.7 Set up automated backups
- [ ] 8.8 Document deployment process
- [ ] 8.9 Dependency audit

After launch:
- [ ] 8.10 (Optional) Wire up error tracking
```

### Phase 9 Checklist (First Month)

```
High priority:
- [ ] 9.2 Real-time collaboration testing
- [ ] 9.3 Performance monitoring
- [ ] 9.5 API rate limiting per user
- [ ] 9.8 Integration tests
- [ ] 9.9 Security audit (OWASP)

Medium priority:
- [ ] 9.1 Frontend lint cleanup
- [ ] 9.4 User analytics
- [ ] 9.6 Audit log
- [ ] 9.7 Webhook notifications
- [ ] 9.10 Documentation expansion
```

### Phase 10 Checklist (Months 2-4)

```
High priority:
- [ ] 10.9 Performance tests
- [ ] 10.10 Load testing

Medium priority:
- [ ] 10.1 Multi-tenancy support
- [ ] 10.2 Advanced search filters
- [ ] 10.3 Document templates
- [ ] 10.4 Export to PDF / HTML / PNG
- [ ] 10.5 Bulk operations
- [ ] 10.6 Tags improvements (hierarchical, colors)
- [ ] 10.7 Folder permissions (shared folders)
- [ ] 10.8 Version history improvements
```

### Phase 11 Checklist (6+ Months)

```
- [ ] 11.1 Mobile app (Flutter 3.44+)
- [ ] 11.2 Desktop app (Tauri or Electron)
- [ ] 11.3 Browser extension
- [ ] 11.4 Public API for third-party integrations
- [ ] 11.5 Plugin system
- [ ] 11.6 Marketplace
- [ ] 11.7 AI-powered features
- [ ] 11.8 Collaborative editing improvements
```

### Common Commands

```bash
# Typecheck
bun run typecheck

# Tests
bun test

# Generate migrations
cd packages/db && bun run db:generate

# Apply migrations
cd packages/db && bun run db:migrate

# Lint
bun run lint

# Generate secret
openssl rand -hex 32

# Backup database
docker compose exec postgres pg_dump -U $DB_USER hiai_docs > backup.sql

# Backup MinIO
docker compose exec minio mc mirror /data ./backup-minio/

# Restore database
docker compose exec -T postgres psql -U $DB_USER hiai_docs < backup.sql
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | Coder (strategic planning) | Initial strategic plan with all 4 phases and 37 tasks |

---

**Plan generated:** 2026-06-14
**Status:** ✅ ACTIVE — Phase 8 execution ready
**Next review:** 2026-06-28 (or upon Phase 8 completion)
