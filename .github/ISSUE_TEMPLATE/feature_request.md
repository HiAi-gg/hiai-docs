---
name: Feature Request
about: Suggest a new feature or enhancement for hiai-docs
title: "[FEATURE] "
labels: ["enhancement", "needs-triage"]
assignees: []
---

## Summary

<!-- One-sentence description of the feature. -->

## Problem / Use Case

<!-- What problem does this solve? Who benefits? Describe the workflow or scenario. -->

> As a [type of user], I want to [action] so that [outcome / value].

## Proposed Solution

<!-- Describe the desired behavior, API, or UI in detail. Mockups, ASCII diagrams, or links to references are welcome. -->

### Example API / UI

```http
POST /api/documents/:id/duplicate
Authorization: Bearer <token>
```

```svelte
<Button on:click={duplicate}>Duplicate</Button>
```

### Database / Schema Changes (if any)

<!-- Describe any new tables, columns, or migrations. -->

## Alternatives Considered

<!-- What other approaches did you consider, and why is this one better? -->

## Out of Scope

<!-- What this feature should NOT do. Be explicit to keep scope tight. -->

## Acceptance Criteria

<!-- A clear checklist we can use to know the feature is done. -->

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Documentation updated (`docs/` and `README.md` if needed)
- [ ] Tests added (unit + integration)
- [ ] No breaking changes (or migration path documented)

## Affected Areas

<!-- Check all that apply. -->

- [ ] Backend API (`backend/src/api/`)
- [ ] Database schema (`packages/db/`)
- [ ] Embedding pipeline (`backend/src/embedding/`)
- [ ] Frontend pages (`frontend/src/routes/`)
- [ ] Frontend components (`frontend/src/lib/`)
- [ ] Docker / deployment
- [ ] Documentation

## Priority

<!-- Your estimate of priority. Maintainers will adjust. -->

- [ ] High — blocks current workflow for many users
- [ ] Medium — valuable but not blocking
- [ ] Low — nice-to-have

## Additional Context

<!-- Links, screenshots, references to similar features in Outline / Docmost / Notion, etc. -->
