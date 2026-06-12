# Pull Request

## Description

<!-- Briefly describe what this PR does and why. Link the related issue with `Closes #123` or `Fixes #123`. -->

Closes #

## Type of Change

<!-- Check all that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Refactor (no functional change)
- [ ] Performance improvement
- [ ] Test addition / improvement
- [ ] CI / build / tooling change

## Summary of Changes

<!-- Bullet list of the meaningful changes. -->

- 
- 
- 

## Affected Areas

<!-- Check all that apply. -->

- [ ] Backend (`backend/`)
- [ ] Frontend (`frontend/`)
- [ ] Database schema (`packages/db/`)
- [ ] Docker / deployment
- [ ] Documentation
- [ ] CI workflows

## Database Changes

<!-- If you modified Drizzle schema or migrations, describe them. -->

- [ ] No schema changes
- [ ] Schema change — `bun run db:generate` produced new migration(s)
- [ ] Migration applied locally and tested

## Testing

<!-- Describe how you tested this change. Include commands you ran. -->

### Local Verification

```bash
# Commands run locally
bun install
bun run lint
bun run typecheck
bun test
```

### Manual / E2E

- [ ] Verified in `bun run dev:all` (backend + frontend)
- [ ] Verified in `docker compose up -d`
- [ ] Browser-tested with `agent-browser` (no Playwright)

## Checklist

<!-- Author self-review before requesting review. -->

- [ ] Code follows the project's style and conventions (`AGENTS.md`)
- [ ] Bun-native — no npm/yarn, no Node-only assumptions
- [ ] ESM-only — no CommonJS
- [ ] TypeScript strict — no `any` introduced, Zod validation on inputs
- [ ] No hardcoded secrets, paths, or keys (all via `.env`)
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] New tests added for new functionality
- [ ] Documentation updated (`docs/`, `README.md`, or inline JSDoc)
- [ ] Self-reviewed the diff — no debug code, console.logs, or commented-out blocks
- [ ] PR title follows Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)

## Screenshots / Recordings

<!-- If UI changes, attach before/after screenshots or a short recording. -->

## Breaking Changes & Migration

<!-- If this is a breaking change, describe the migration path. -->

## Additional Notes

<!-- Anything reviewers should pay special attention to. -->
