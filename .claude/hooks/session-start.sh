#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Ensure PHP extensions required by the project are available
# The project uses PDO + SQLite, sessions, and json
php -m | grep -qi pdo_sqlite || {
  echo "WARNING: pdo_sqlite extension not available"
  exit 1
}

# Ensure data directory exists for SQLite database
mkdir -p "$CLAUDE_PROJECT_DIR/dashboard/data"

# Install composer if composer.json is added in the future
if [ -f "$CLAUDE_PROJECT_DIR/composer.json" ]; then
  cd "$CLAUDE_PROJECT_DIR"
  composer install --no-interaction --no-progress
fi

# Install npm dependencies if package.json is added in the future
if [ -f "$CLAUDE_PROJECT_DIR/package.json" ]; then
  cd "$CLAUDE_PROJECT_DIR"
  npm install
fi
