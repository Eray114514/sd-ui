#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
GIT_LOG="$LOG_DIR/git-pull.log"
HOT_DEPLOY="$SCRIPT_DIR/hot-deploy.sh"

mkdir -p "$LOG_DIR"

cd "$APP_DIR"

LATEST_HASH_FILE="$LOG_DIR/.last_commit_hash"
CURRENT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ -z "$CURRENT_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Not a git repository or no commits" >> "$GIT_LOG"
    exit 1
fi

if [ -f "$LATEST_HASH_FILE" ]; then
    LAST_HASH=$(cat "$LATEST_HASH_FILE")
    if [ "$CURRENT_HASH" = "$LAST_HASH" ]; then
        exit 0
    fi
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Detected new commits, starting hot deployment..." >> "$GIT_LOG"
echo "$CURRENT_HASH" > "$LATEST_HASH_FILE"

if [ -x "$HOT_DEPLOY" ]; then
    "$HOT_DEPLOY"
else
    echo "hot-deploy.sh not found or not executable"
    exit 1
fi
