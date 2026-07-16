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
VERSION="${VERSION#v}"
REGISTRY="${REGISTRY:-ghcr.io/hiai-gg}"
IMAGE_NAME="${IMAGE_NAME:-docsmint}"
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

echo "==> Building DocsMint v${VERSION} (registry: ${REGISTRY}/${IMAGE_NAME})"
echo ""

# Build the three release images (postgres/redis/etc. are upstream dependencies).
echo "--- Building api image ---"
docker compose build api

echo ""
echo "--- Building web image ---"
docker compose build web

echo ""
echo "--- Building caddy image ---"
docker compose build caddy

echo ""
echo "==> Tagging images"

for role in api web caddy; do
  docker tag "${IMAGE_NAME}-${role}:local" "${REGISTRY}/${IMAGE_NAME}-${role}:${VERSION}"
  docker tag "${IMAGE_NAME}-${role}:local" "${REGISTRY}/${IMAGE_NAME}-${role}:latest"
done

echo ""
echo "==> Built images:"
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" \
  | grep -E "(${REGISTRY}/${IMAGE_NAME}-(api|web|caddy)|${IMAGE_NAME}-(api|web|caddy))" \
  || true

echo ""
echo "==> Done. Push with:"
for role in api web caddy; do
  echo "  docker push ${REGISTRY}/${IMAGE_NAME}-${role}:${VERSION}"
  echo "  docker push ${REGISTRY}/${IMAGE_NAME}-${role}:latest"
done

# Optional: push immediately if PUSH=1
if [ "${PUSH}" = "1" ]; then
  echo ""
  echo "==> PUSH=1 set — pushing images to ${REGISTRY}..."
  for role in api web caddy; do
    docker push "${REGISTRY}/${IMAGE_NAME}-${role}:${VERSION}"
    docker push "${REGISTRY}/${IMAGE_NAME}-${role}:latest"
  done
  echo "==> Push complete."
fi
