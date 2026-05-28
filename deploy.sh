#!/bin/bash
set -e

# --- Docker 배포 (새 서버) ---
if [ "$1" = "docker" ]; then
  echo "Pulling latest changes..."
  git pull

  echo "Building and starting Docker containers..."
  docker compose down
  docker compose build --no-cache
  docker compose up -d

  echo "Container status:"
  docker compose ps
  echo "Deployment complete (Docker)"
  exit 0
fi

# --- systemd 배포 (레거시, 현재 서버) ---
echo "Stopping ipm-saas service..."
sudo systemctl stop ipm-saas || true

echo "Building the application..."
npm run build

echo "Starting ipm-saas service..."
sudo systemctl start ipm-saas
sudo systemctl status ipm-saas --no-pager

echo "Deployment complete (systemd)"
