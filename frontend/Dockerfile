FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY packages/db/package.json ./packages/db/
RUN bun install

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY frontend/ ./frontend/
COPY packages/db/ ./packages/db/

# =====================================================================
# PATCH: @inlang/sdk 0.37.0 data: URL → blob: URL for Bun NameTooLong
# =====================================================================
#
# DEPENDENCY CHAIN THAT CAUSES THIS:
#   @inlang/paraglide-sveltekit@0.16.1
#   -> @inlang/paraglide-js@1.11.8 (exact pin -- no ^ range)
#   -> @inlang/sdk@0.37.0         (exact pin -- no ^ range)
#     -> dist/resolve-modules/import.js uses data:application/javascript, + encodeURIComponent()
#
# THE BUG:
# Bun 1.3.14's URL parser enforces a maximum length on specifiers used with
# dynamic import(). When the local plugin module text exceeds ~64 KB, the
# data:application/javascript,... URL triggers "NameTooLong" and the Docker
# build fails.
#
# THE FIX:
# URL.createObjectURL(new Blob([moduleAsText], {type:"text/javascript"}))
# returns a short blob: URL (blob:https://... or blob://...) that stays well
# within Bun's length limit. This is a Bun-only runtime fix -- Node.js and
# other runtimes continue to use the original data: URL path.
#
# WHY ALTERNATIVES WERE REJECTED (investigated 2026-06-12):
#
#   [X] Upgrade paraglide-sveltekit -> 1.0.0-beta.x:
#       The beta line (1.0.0-beta.1..7) replaced the entire API surface.
#       0.x: createI18n(runtime) returning { reroute, handle } for SvelteKit hooks.
#       Beta: Bare Vite plugin wrapper (paraglideSveltekit()) -- no createI18n export.
#       Migration requires a full i18n layer refactor (hooks.ts, vite.config.ts, i18n.ts).
#       No stable 1.0.0 release exists on npm as of 2026-06-12.
#       Check: npm view @inlang/paraglide-sveltekit versions --json
#       Remove this block only when a stable >=1.0.0 with a compatible API is available.
#
#   [X] Override @inlang/sdk to @^2.10.0 in package.json:
#       sdk@2.x is a complete kysely-based rewrite. paraglide-js@1.11.8 directly
#       imports 0.x-only exports: defaultProjectSettings, loadProject, listProjects,
#       createNewProject, isValidLanguageTag, lookup, ModuleError. These don't exist
#       in sdk@2.x -- the build would compile but crash at runtime.
#
#   [X] Patch any intermediate package:
#       @inlang/sdk last 0.x = 0.37.0 (no 0.37.1 with a fix).
#       @inlang/paraglide-js last 1.x = 1.11.8 (no 1.11.9 or 1.12.x).
#       @inlang/paraglide-unplugin last = 1.9.5 (same locked chain).
#
# VERDICT: The sed patch below is the ONLY viable fix until a stable
# paraglide-sveltekit release (>1.0.0) with a non-breaking API emerges.
#
# WHEN THIS BLOCK CAN BE REMOVED:
#  1. Run: npm view @inlang/paraglide-sveltekit versions --json
#     If a stable version >=1.0.0 exists, the upgrade is possible.
#  2. Update the i18n integration (frontend/src/lib/i18n.ts, hooks.ts)
#     to match the new API (likely Vite plugin pattern).
#  3. Update frontend/package.json to the new version.
#  4. Delete this RUN block and rebuild.
# =====================================================================
RUN SDK_IMPORT=$(find /app/node_modules/.bun -path '*@inlang+sdk@0.37.0*/node_modules/@inlang/sdk/dist/resolve-modules/import.js' | head -1) \
    && if [ -n "$SDK_IMPORT" ]; then \
         sed -i 's|const moduleWithMimeType = "data:application/javascript," + encodeURIComponent(moduleAsText);|const moduleWithMimeType = process.versions.bun ? URL.createObjectURL(new Blob([moduleAsText], { type: "text/javascript" })) : "data:application/javascript," + encodeURIComponent(moduleAsText);|' "$SDK_IMPORT" \
         && echo "Patched: $SDK_IMPORT"; \
       fi

RUN cd frontend && bun run build

# Run
FROM base AS runtime
COPY --from=build /app/frontend/build ./frontend/build
COPY frontend/package.json ./frontend/

ENV NODE_ENV=production
ENV WEB_PORT=50701
WORKDIR /app/frontend

RUN addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app/frontend  # COPY files are root-owned by default; chown is required for non-root USER

USER app

EXPOSE 50701

CMD ["bun", "run", "build/index.js"]
