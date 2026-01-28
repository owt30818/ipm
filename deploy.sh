#!/bin/bash
set -e

echo "🛑 Stopping ipm-saas service..."
sudo systemctl stop ipm-saas || true

echo "🏗️ Building the application..."
npm run build

echo "📂 Preparing standalone build..."
# Copy static assets to standalone directory
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/public
# If public directory exists, copy it (ignoring error if empty/missing)
if [ -d "public" ]; then
    cp -r public/* .next/standalone/public/ || true
fi

echo "🚀 Starting ipm-saas service..."
sudo systemctl start ipm-saas
sudo systemctl status ipm-saas --no-pager

echo "✅ Deployment complete!"
