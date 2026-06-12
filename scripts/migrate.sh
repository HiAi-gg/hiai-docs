#!/bin/bash
# hiai-docs database migration script
# Usage: ./scripts/migrate.sh [--yes] [--generate-only]
#
# Runs the Drizzle workflow against the configured database:
#   1. bun install                 (if node_modules missing)
#   2. db:generate                 (regenerate SQL from packages/db/src/schema.ts)
#   3. db:push                     (apply schema to DATABASE_URL)
#
# Flags:
#   --yes           skip the "are you sure?" confirmation prompt
#   --generate-only run db:generate only, skip the actual db:push
#   --help          show this help and exit
#
# Environment:
#   DB_HOST / DB_PORT / DB_USER / DB_NAME / DB_PASSWORD  override .env
#   DATABASE_URL    full connection string (takes precedence if set)
#
# Example:
#   ./scripts/migrate.sh
#   ./scripts/migrate.sh --yes
#   ./scripts/migrate.sh --generate-only

set -euo pipefail

# --- Argument parsing ---
SKIP_CONFIRM=0
GENERATE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --yes)            SKIP_CONFIRM=1 ;;
    --generate-only)  GENERATE_ONLY=1 ;;
    --help|-h)
      sed -n '2,18p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $arg"
      echo "   Run with --help for usage."
      exit 2
      ;;
  esac
done

# --- Sanity checks ---
if [ ! -f "package.json" ] || [ ! -d "packages/db" ]; then
  echo "❌ package.json or packages/db not found."
  echo "   Run this script from the hiai-docs project root."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "❌ bun is required but not installed."
  echo "   Install: https://bun.sh/docs/installation"
  exit 1
fi

# Load .env if it exists (so DATABASE_URL / DB_* are available)
if [ -f ".env" ] && [ -z "${DATABASE_URL:-}" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set."
  echo "   Either set it in .env, or export DATABASE_URL before running this script."
  exit 1
fi

# --- Pre-flight: confirm the database is reachable ---
echo "==> hiai-docs Migration"
echo "    DATABASE_URL=${DATABASE_URL}"
echo ""

if command -v psql >/dev/null 2>&1; then
  if ! psql "${DATABASE_URL}" -c "SELECT 1" >/dev/null 2>&1; then
    echo "❌ Cannot connect to database at ${DATABASE_URL}."
    echo "   Start the stack with: docker compose up -d postgres"
    exit 1
  fi
  echo "    ✅ Database reachable"
else
  echo "    ⚠️  psql not found — skipping connectivity check (db:push will fail loudly if unreachable)"
fi

# --- Confirm destructive intent (db:push drops + recreates tables) ---
if [ "$GENERATE_ONLY" -eq 0 ] && [ "$SKIP_CONFIRM" -eq 0 ]; then
  echo ""
  echo "⚠️  About to push schema to ${DATABASE_URL}."
  echo "   db:push will ALTER tables to match the Drizzle schema (destructive on type changes)."
  printf "   Continue? [y/N] "
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *)
      echo "Aborted."
      exit 0
      ;;
  esac
fi

echo ""

# --- Install deps if needed ---
if [ ! -d "node_modules" ] || [ ! -d "packages/db/node_modules" ]; then
  echo "==> Installing dependencies..."
  bun install
else
  echo "==> Dependencies already installed (skipping bun install)"
fi

# --- Regenerate migration SQL from schema ---
echo ""
echo "==> Regenerating SQL migrations from packages/db/src/schema.ts..."
cd packages/db
bun run db:generate
cd ../..

# --- Push to database (unless --generate-only) ---
if [ "$GENERATE_ONLY" -eq 1 ]; then
  echo ""
  echo "✅ Migrations regenerated (--generate-only; db:push skipped)"
  exit 0
fi

echo ""
echo "==> Pushing schema to ${DATABASE_URL}..."
cd packages/db
bun run db:push
cd ../..

echo ""
echo "✅ Migration complete"
