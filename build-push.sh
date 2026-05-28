#!/bin/bash
set -e

# Docker Hub 유저명으로 변경하세요
DOCKERHUB_USER=owt30818
IMAGE=${DOCKERHUB_USER}/ipam-app
TAG=${1:-latest}

# Load NEXT_PUBLIC_* build args from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep 'NEXT_PUBLIC_' | xargs)
else
  echo "ERROR: .env.local not found"
  exit 1
fi

echo "Building ${IMAGE}:${TAG} ..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" \
  -t "${IMAGE}:${TAG}" \
  .

echo "Pushing ${IMAGE}:${TAG} ..."
docker push "${IMAGE}:${TAG}"

echo "Done: ${IMAGE}:${TAG}"
