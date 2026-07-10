# Task 7 Report: Automatic GraphRAG Search Orchestration

## Status

DONE

## Commit

- `64292a8 feat(search): orchestrate adaptive GraphRAG retrieval`

## Delivered

- Added `searchDocuments(ctx, request)` as the domain orchestration boundary.
- Runs exact, FTS, fuzzy, and vector retrieval in a fast pass, evaluates deterministic confidence, and performs at most one structured query expansion pass.
- Runs expanded lexical/vector channels concurrently through bounded `Promise.allSettled` and fuses direct plus expanded candidates with the existing RRF implementation.
- Invokes GraphRAG automatically for every non-empty search; the `GRAPH_SEARCH_ENABLED` operator flag remains the kill switch.
- Added `retrieveGraphCandidates()` with a configurable seed cap, hop cap, relationship evidence, and owner/share-scope visibility adapter.
- Added a query-plan AGE seed path for concepts, named entities, translations, and synonyms when the direct pass has no seeds.
- Graph failures and expansion/provider failures degrade to available direct results; healthy empty channels return `no_relevant_candidates` diagnostics.
- Added `SEARCH_GRAPH_MAX_HOPS` and `SEARCH_GRAPH_RESULT_LIMIT` configuration defaults.
- Added fake-adapter orchestration coverage for all nine Task 7 scenarios, including tenant-context identity and concept/entity graph seeding.

## Verification

```text
cd backend && bun test src/__tests__/search-orchestrator.test.ts src/__tests__/graph-expand.test.ts src/__tests__/graph-routes.test.ts
16 pass, 0 fail

cd backend && bun run typecheck
PASS

cd backend && bunx biome check \
  src/search/graph-retriever.ts src/search/orchestrator.ts \
  src/lib/graph/search-expansion.ts src/__tests__/search-orchestrator.test.ts \
  src/__tests__/graph-expand.test.ts src/lib/config-schema.ts
PASS

git diff --check
PASS
```

The focused test process logs the expected Redis connection warning when the local Redis service is not running; this does not fail the tests and expansion failures remain non-fatal by design.

## Handoff

Task 8 can now replace the HTTP route's legacy merge with `searchDocuments()` and hydrate the returned owner-scoped IDs. The orchestrator intentionally does not change HTTP request validation or frontend behavior.

