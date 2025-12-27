#!/bin/bash

# Deploy Big Two to production server
# Usage: ./deploy.sh

set -e

SERVER="rhuk-personal"
REMOTE_PATH="~/webapps/bigtwo"

echo "🎴 Deploying Big Two..."

# Build frontend
echo "📦 Building frontend..."
npm run build

# Sync files to server
echo "🚀 Syncing files to $SERVER:$REMOTE_PATH..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.svelte-kit' \
  --exclude 'data/*.db' \
  --exclude 'logs' \
  --exclude '.DS_Store' \
  ./ "$SERVER:$REMOTE_PATH/"

# Install dependencies and restart on server
echo "📥 Installing dependencies on server..."
ssh "$SERVER" "cd $REMOTE_PATH && npm install --production=false"

echo "🔄 Restarting PM2..."
ssh "$SERVER" "cd $REMOTE_PATH && pm2 restart bigtwo 2>/dev/null || pm2 start ecosystem.config.cjs"
ssh "$SERVER" "pm2 save"

echo ""
echo "✅ Deployment complete!"
echo "🌐 https://bigtwo.dev"
