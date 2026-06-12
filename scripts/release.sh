#!/bin/bash
# hiai-docs release script
# Usage: ./scripts/release.sh [version]
#   version: semver-style tag (default: timestamp YYYYMMDD.HHMM)
#
# Environment:
#   REGISTRY  container registry (default: ghcr.io/hiai-gg)
#   PUSH      if set to "1", also push images after tagging
#
# Example:
#   ./scripts/release.sh v0.1.0
#   PUSH=1 ./scripts/release.sh v0.1.0

set -euo pipefail

VERSION="${1:-$(date +%Y%m%d.%H%M)}"
REGISTRY="${REGISTRY:-ghcr.io/hiai-gg}"
PUSH="${PUSH:-0}"

# Sanity: must be run from project root (where docker-compose.yml lives)
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found in current directory."
  echo "   Run this script from the hiai-docs project root."
  exit 1
fi

# Sanity: docker must be available
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker is required but not installed."
  exit 1
fi

# Sanity: docker compose v2 must be available
if ! docker compose version >/dev/null 2>&1; then
  echo "❌ docker compose v2 is required (got docker-compose v1 or none)."
  exit 1
fi

echo "==> Building hiai-docs v${VERSION} (registry: ${REGISTRY})"
echo ""

# Build both application images (postgres/redis/etc. are pulled from upstream, not built)
echo "--- Building api image ---"
docker compose build api

echo ""
echo "--- Building web image ---"
docker compose build web

echo ""
echo "==> Tagging images"

# Tag api with version + latest
docker tag hiai-docs-api:latest "${REGISTRY}/hiai-docs-api:${VERSION}"
docker tag hiai-docs-api:latest "${REGISTRY}/hiai-docs-api:latest"

# Tag web with version + latest
docker tag hiai-docs-web:latest "${REGISTRY}/hiai-docs-web:${VERSION}"
docker tag hiai-docs-web:latest "${REGISTRY}/hiai-docs-web:latest"

echo ""
echo "==> Built images:"
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" \
  | grep -E "(${REGISTRY}/hiai-docs-(api|web)|hiai-docs-(api|web))" \
  || true

echo ""
echo "==> Done. Push with:"
echo "  docker push ${REGISTRY}/hiai-docs-api:${VERSION}"
echo "  docker push ${REGISTRY}/hiai-docs-api:latest"
echo "  docker push ${REGISTRY}/hiai-docs-web:${VERSION}"
echo "  docker push ${REGISTRY}/hiai-docs-web:latest"

# Optional: push immediately if PUSH=1
if [ "${PUSH}" = "1" ]; then
  echo ""
  echo "==> PUSH=1 set — pushing images to ${REGISTRY}..."
  docker push "${REGISTRY}/hiai-docs-api:${VERSION}"
  docker push "${REGISTRY}/hiai-docs-api:latest"
  docker push "${REGISTRY}/hiai-docs-web:${VERSION}"
  docker push "${REGISTRY}/hiai-docs-web:latest"
  echo "==> Push complete."
fi
