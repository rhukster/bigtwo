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
  --exclude 'data' \
  --exclude 'logs' \
  --exclude '.DS_Store' \
  ./ "$SERVER:$REMOTE_PATH/"

echo ""
echo "✅ Files synced!"

# Ensure data directory exists (excluded from sync to preserve database)
echo "📁 Ensuring data directory exists..."
ssh "$SERVER" "mkdir -p $REMOTE_PATH/data"

# Recreate _app symlink (Nginx serves static files from webroot)
echo "🔗 Creating _app symlink..."
ssh "$SERVER" "cd $REMOTE_PATH && ln -sfn build/_app _app"

echo ""
echo "To complete setup, SSH to server and run:"
echo "  cd $REMOTE_PATH"
echo "  npm install"
echo "  pm2 restart bigtwo"
