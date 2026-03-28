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
ensure_scripts_executable() {
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
    chmod +x "$REPO_DIR"/scripts/*.sh 2>/dev/null || true
}

git_reset_and_pull() {
    git fetch origin
    git reset --hard origin/main 2>&1 | tee -a "$GIT_LOG" || true
    ensure_scripts_executable
}

git fetch origin
REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "")
LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ -z "$LOCAL_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Not a git repository" >> "$GIT_LOG"
    exit 1
fi

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Detected new commits, pulling..." >> "$GIT_LOG"
git_reset_and_pull
echo "$REMOTE_HASH" > "$LATEST_HASH_FILE"

CHANGED_FILES=$(git diff --name-only "$LOCAL_HASH" "$REMOTE_HASH" 2>/dev/null || echo "")

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
        *.md|README*|LICENSE|CONTRIBUTING*|.gitignore|.env*|*.yml|*.yaml)
            ;;
        *)
            ;;
    esac
done

RELEVANT_CHANGE=false
if [ "$SCRIPTS_CHANGED" = true ] || [ "$BACKEND_CHANGED" = true ] || [ "$FRONTEND_ONLY" = true ]; then
    RELEVANT_CHANGE=true
fi

if [ "$RELEVANT_CHANGE" = false ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Only docs/config files changed, no action needed" >> "$GIT_LOG"
    exit 0
fi

if [ "$SCRIPTS_CHANGED" = true ] && [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Only scripts changed, no restart needed" >> "$GIT_LOG"
    git_reset_and_pull
    echo "$(date '+%Y-%m-%d %H:%M:%S') Scripts updated successfully" >> "$GIT_LOG"
elif [ "$BACKEND_CHANGED" = true ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Backend/API changes detected, performing hot deployment..." >> "$GIT_LOG"
    git_reset_and_pull
    ensure_scripts_executable
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        exit 1
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Frontend only changes, rebuilding without restart..." >> "$GIT_LOG"
    git_reset_and_pull
    npm install >> "$GIT_LOG" 2>&1
    npx prisma generate >> "$GIT_LOG" 2>&1
    npm run build >> "$GIT_LOG" 2>&1

    if [ -f "$STATIC_SYNC" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') Syncing static files..." >> "$GIT_LOG"
        node "$STATIC_SYNC" >> "$GIT_LOG" 2>&1 || true
    fi

    echo "$(date '+%Y-%m-%d %H:%M:%S') Frontend rebuilt successfully (no restart - Next.js hot reload handles it)" >> "$GIT_LOG"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') Generic update, performing hot deployment..." >> "$GIT_LOG"
    git_reset_and_pull
    ensure_scripts_executable
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    fi
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Update complete" >> "$GIT_LOG"
