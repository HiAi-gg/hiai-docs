FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY frontend/ ./frontend/
COPY packages/db/ ./packages/db/

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
