#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
LOG_FILE="$LOG_DIR/hot-deploy.log"
SHUTDOWN_TIMEOUT=30

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

wait_for_processing_tasks() {
    local elapsed=0
    log "Checking for processing tasks..."

    DB_PATH="$APP_DIR/prisma/dev.db"

    while true; do
        PROCESSING_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Task WHERE status='processing';" 2>/dev/null || echo "0")

        if [ "$PROCESSING_COUNT" -eq 0 ]; then
            log "No processing tasks, safe to proceed"
            return 0
        fi

        log "Waiting for $PROCESSING_COUNT processing task(s) to complete (elapsed: ${elapsed}s)..."

        if [ "$elapsed" -ge "$SHUTDOWN_TIMEOUT" ]; then
            log "Timeout reached, resetting processing tasks to pending..."
            sqlite3 "$DB_PATH" "UPDATE Task SET status='pending' WHERE status='processing';" 2>/dev/null || true
            log "Processing tasks reset to pending, they will be retried after restart"
            return 0
        fi

        sleep 5
        elapsed=$((elapsed + 5))
    done
}

log "=== Starting hot deployment ==="

cd "$APP_DIR"

CURRENT_PORT=$(ss -tlnp 2>/dev/null | grep -oP '300[01]' | sort -u | head -1 || echo "3000")
NEW_PORT=$([ "$CURRENT_PORT" = "3000" ] && echo "3001" || echo "3000")

log "Current port: $CURRENT_PORT, deploying on port: $NEW_PORT"

log "Pulling latest code..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

log "Installing dependencies..."
npm ci --silent 2>&1 | tee -a "$LOG_FILE"

log "Generating Prisma..."
npx prisma generate --silent 2>&1 | tee -a "$LOG_FILE"

log "Building..."
npm run build 2>&1 | tee -a "$LOG_FILE"

log "Waiting for current processing tasks before switching..."
wait_for_processing_tasks 0

log "Starting new instance on port $NEW_PORT..."

if [ -f .next/standalone/server.js ]; then
    PORT=$NEW_PORT node .next/standalone/server.js -H 0.0.0.0 >> "$LOG_DIR/app-$NEW_PORT.log" 2>> "$LOG_DIR/error-$NEW_PORT.log" &
elif [ -f .next/standalone/ui/server.js ]; then
    PORT=$NEW_PORT node .next/standalone/ui/server.js -H 0.0.0.0 >> "$LOG_DIR/app-$NEW_PORT.log" 2>> "$LOG_DIR/error-$NEW_PORT.log" &
else
    log "ERROR: No standalone build found"
    exit 1
fi

NEW_PID=$!
log "New instance PID: $NEW_PID"

sleep 5

if kill -0 $NEW_PID 2>/dev/null; then
    log "New instance started successfully, switching proxy..."

    if [ -f "$REPO_DIR/scripts/nginx-dev.conf" ]; then
        sudo nginx -s reload 2>&1 | tee -a "$LOG_FILE"
    fi

    sleep 2

    OLD_PID=$(pgrep -f "node.*3000" 2>/dev/null | head -1 || true)
    if [ -n "$OLD_PID" ] && [ "$OLD_PID" != "$NEW_PID" ]; then
        log "Stopping old instance (PID: $OLD_PID)..."
        kill $OLD_PID 2>/dev/null || true
        sleep 2
        kill -9 $OLD_PID 2>/dev/null || true
    fi

    log "=== Hot deployment complete ==="
else
    log "ERROR: New instance failed to start"
    exit 1
fi
