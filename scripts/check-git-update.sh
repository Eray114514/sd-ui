#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
GIT_LOG="$LOG_DIR/git-pull.log"
STATIC_SYNC="$SCRIPT_DIR/sync-standalone-static.mjs"

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

echo "$(date '+%Y-%m-%d %H:%M:%S') Detected new commits, analyzing changes..." >> "$GIT_LOG"
echo "$CURRENT_HASH" > "$LATEST_HASH_FILE"

git fetch origin
CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

echo "Changed files: $CHANGED_FILES" >> "$GIT_LOG"

SCRIPTS_CHANGED=false
FRONTEND_ONLY=false
BACKEND_CHANGED=false

for file in $CHANGED_FILES; do
    case "$file" in
        scripts/*)
            SCRIPTS_CHANGED=true
            ;;
        ui/src/app/api/*|ui/src/lib/*|ui/prisma/*|ui/src/services/*|ui/src/components/custom/*)
            BACKEND_CHANGED=true
            ;;
        ui/src/*|ui/*.css|ui/components.json)
            FRONTEND_ONLY=true
            ;;
    esac
done

if [ "$SCRIPTS_CHANGED" = true ] && [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Only scripts changed, no restart needed" >> "$GIT_LOG"
    git pull origin main >> "$GIT_LOG" 2>&1
    chmod +x "$SCRIPT_DIR"/*.sh
    echo "$(date '+%Y-%m-%d %H:%M:%S') Scripts updated successfully" >> "$GIT_LOG"
elif [ "$BACKEND_CHANGED" = true ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Backend/API changes detected, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        exit 1
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Frontend only changes, rebuilding..." >> "$GIT_LOG"
    git pull origin main >> "$GIT_LOG" 2>&1
    npm ci --silent >> "$GIT_LOG" 2>&1
    npx prisma generate >> "$GIT_LOG" 2>&1
    npm run build >> "$GIT_LOG" 2>&1

    if [ -f "$STATIC_SYNC" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') Syncing static files..." >> "$GIT_LOG"
        node "$STATIC_SYNC" >> "$GIT_LOG" 2>&1 || true
    fi

    systemctl --user restart sd-ui
    echo "$(date '+%Y-%m-%d %H:%M:%S') Frontend rebuilt and synced successfully" >> "$GIT_LOG"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') Generic update, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    fi
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Update complete" >> "$GIT_LOG"
