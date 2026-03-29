#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
LOG_FILE="$LOG_DIR/hot-deploy.log"
BACKUP_DIR="${HOME}/.local/share/sd-ui/backups"
SHUTDOWN_TIMEOUT=30

mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

backup_database() {
    DB_PATH="$APP_DIR/prisma/dev.db"
    if [ -f "$DB_PATH" ]; then
        BACKUP_NAME="dev.db.$(date '+%Y%m%d_%H%M%S').backup"
        BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
        cp "$DB_PATH" "$BACKUP_PATH"
        log "Database backed up to: $BACKUP_PATH"
        
        local old_backups=($(ls -t "$BACKUP_DIR"/dev.db.*.backup 2>/dev/null || true))
        if [ ${#old_backups[@]} -gt 5 ]; then
            for ((i=5; i<${#old_backups[@]}; i++)); do
                rm -f "${old_backups[$i]}"
                log "Removed old backup: ${old_backups[$i]}"
            done
        fi
    fi
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

log "Pulling latest version..."
git pull origin main --ff-only 2>&1 | tee -a "$LOG_FILE"

log "Backing up database..."
backup_database

log "Installing dependencies..."
npm install 2>&1 | tee -a "$LOG_FILE"

log "Generating Prisma client..."
npx prisma generate 2>&1 | tee -a "$LOG_FILE"

log "Running database migrations..."
if [ -d "$APP_DIR/prisma/migrations" ]; then
    npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE" || {
        log "Migration failed, attempting to resolve..."
        npx prisma migrate resolve --applied 2>&1 | tee -a "$LOG_FILE" || true
    }
else
    log "No migrations directory found, skipping migrate deploy"
fi

log "Building..."
npm run build 2>&1 | tee -a "$LOG_FILE"

log "Waiting for current processing tasks before restart..."
wait_for_processing_tasks 0

log "Restarting service..."
systemctl --user restart sd-ui

log "=== Hot deployment complete ==="
