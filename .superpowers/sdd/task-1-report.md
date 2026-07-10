# Task 1 Report: Generation-Aware Embedding and Multilingual Search Schema

Status: DONE_WITH_CONCERNS

## Commit

- Implementation commit: `991407c` (`feat(db): add embedding generation lifecycle`).

## Files changed

- `packages/db/src/migrations/0025_search_embedding_generations.sql`
- `packages/db/src/migrations/meta/_journal.json`
- `packages/db/src/schema.ts`
- `packages/db/src/search-embedding-schema.test.ts`

## Implementation

- Added the `embedding_status` enum with `pending`, `processing`, `ready`, `failed`, and `stale` states.
- Added document embedding lifecycle, generation, profile, error, and timestamp columns.
- Added embedding generation, dimension, profile, and validity columns.
- Added the language-neutral generated `search_vector_simple` while preserving the English generated vector.
- Replaced the document/chunk unique index with document/generation/chunk uniqueness and added generation-validity and lifecycle indexes.
- Backfilled one UUID generation per legacy document, marked only non-zero 1024-dimensional vectors with a non-empty model as valid, and marked document generations ready only when every row is valid.
- Kept existing HNSW and StreamingDiskANN schema declarations unchanged.

## Verification

1. `cd packages/db && bun test src/search-embedding-schema.test.ts`

   PASS — 2 tests, 0 failures.

2. `cd packages/db && bun run typecheck`

   PASS — `tsc --noEmit` completed successfully.

3. `MIGRATION_DATABASE_URL=<local hiai-docs DATABASE_URL> bun run db:migrate`

   PASS on the existing upgraded database. Migration 0025 was applied as journal entry 26.

4. Existing database schema verification with `psql`

   PASS — enum states are ordered as expected; all four embedding lifecycle columns are NOT NULL with the requested defaults; all four new indexes exist; 583 embedding rows were inspected, with 513 valid rows and 513 independently matching the validity predicate; 84 documents expose the generated simple vector.

5. Fresh disposable database migration

   BLOCKED by the pre-existing migration `0008_streaming_diskann_index.sql`: the local PostgreSQL image does not expose the `diskann` access method (`ERROR: access method "diskann" does not exist`). The disposable database was removed after the check. This is an environment/bootstrap issue before migration 0025 and is not caused by the Task 1 changes.

## Concerns

- The migration journal timestamps in this repository are in the future relative to the current wall clock. The new entry uses `1785000000011`, immediately after migration 0024, so Drizzle applies it after the existing history. A current-wall-clock timestamp would have been treated as already applied by Drizzle.
- Full fresh-database verification remains dependent on making the configured PostgreSQL image provide the `diskann` access method or making migration 0008 conditionally skip it when the extension is unavailable.

## Isolation cleanup

- Restored `SEARCH_VECTOR_MIN_SIMILARITY` validation to `.min(-1)` so the Task 1 commit contains no unrelated Task 6 configuration change. No schema or migration files were modified.
