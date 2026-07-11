# Task 8 Review Follow-up Report

## Blockers fixed

- Search requests now pass page, limit, sort, folder, category, tag, and date filters into the search domain. The route no longer retrieves a first-100 page and filters it locally, so domain totals and pagination are computed after scoped filtering.
- Anonymous share search accepts `x-share-token` (and `x-share-password` when required), resolves the complete document allow-list through the share-link owner scope, and passes `GraphVisibilityScope.kind = "share"` with those IDs to GraphRAG. Missing, expired, mismatched, and unauthenticated access remains `401`.
- `includeChunks` embeds the query once, restricts rows to the active valid 1024-dimensional generation/profile, orders by cosine similarity, and returns at most three finite-scored chunks. Constant zero scores and index-order hydration were removed.
- Folder and tag metadata hydration is owner-scoped. Public documents cannot pull private folder or tag names from another owner, and share responses remain limited to the token allow-list.
- Added an injectable route/hydrator test path that verifies a non-empty result preserves vector/GraphRAG explanations and forwards global filters. The frontend `SearchResult.explanations` field is required and chunk metadata is typed.

## Verification

- Backend route/category/share/search/GraphRAG tests: 60 passed, 0 failed.
- Backend chunk helper and non-empty route contract: 38 passed, 0 failed.
- Frontend API/component tests: 10 passed, 0 failed.
- Frontend typecheck: passed with zero diagnostics.
- Backend typecheck: passed.
- Backend and frontend lint: passed.
- `git diff --check`: passed.

## Scope

GraphRAG remains automatic; legacy graph query fields are accepted only for the temporary deprecation header and do not control execution. No credentials, release tags, or pushes were changed.
