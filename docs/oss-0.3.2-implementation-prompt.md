# DocsMint OSS 0.3.2 execution brief

Implement the canonical contract in
[oss-0.3.2-integration-prompt.md](./oss-0.3.2-integration-prompt.md).

Priority order: immutable SDK context and workspace assertion boundary;
scope-bound cursor listing; server-only lifecycle/NDJSON contracts and durable
fenced saga; public HTTPS storage configuration; explicit packed frontend
façades; migration/RLS/clean-clone package verification. Do not introduce
frontend behavior changes, SaaS workspace policy, billing, deployments, DNS,
or publication actions.

Local release verification is `bun run test:release`. The live lifecycle
persistence/RLS fixture additionally requires an isolated migrated PostgreSQL
database and runs with:

```bash
LIFECYCLE_TEST_DATABASE_URL=postgresql://... bun run test:lifecycle:integration
```
