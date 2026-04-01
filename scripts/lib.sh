#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"

CONFIG_FILE="$REPO_DIR/.deployrc"
DEFAULT_CONFIG="$SCRIPT_DIR/.deployrc.example"

load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        set -a
        source "$CONFIG_FILE"
        set +a
    fi

    LOG_DIR="${LOG_DIR:-${HOME}/.local/share/sd-ui/logs}"
    BACKUP_DIR="${BACKUP_DIR:-${HOME}/.local/share/sd-ui/backups}"
    STATE_DIR="${STATE_DIR:-${HOME}/.local/share/sd-ui/state}"
    LOCK_DIR="${LOCK_DIR:-/tmp}"

    MAX_LOG_SIZE_MB="${MAX_LOG_SIZE_MB:-10}"
    MAX_LOG_BACKUPS="${MAX_LOG_BACKUPS:-5}"
    MAX_DB_BACKUPS="${MAX_DB_BACKUPS:-5}"
    MAX_DEPLOY_STATS="${MAX_DEPLOY_STATS:-100}"
    SHUTDOWN_TIMEOUT="${SHUTDOWN_TIMEOUT:-30}"
    PORT="${PORT:-3001}"
    SERVICE_NAME="${SERVICE_NAME:-sd-ui}"
    GIT_BRANCH="${GIT_BRANCH:-main}"

    mkdir -p "$LOG_DIR" "$BACKUP_DIR" "$STATE_DIR"
}

acquire_lock() {
    local lock_name="$1"
    local lock_file="$LOCK_DIR/sd-ui-${lock_name}.lock"

    if [ -f "$lock_file" ]; then
        local pid=$(cat "$lock_file" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "Another instance is running (PID: $pid), exiting"
            exit 0
        fi
        rm -f "$lock_file"
    fi
    echo $$ > "$lock_file"
    trap "rm -f '$lock_file'" EXIT
}

rotate_logs() {
    local log_dir="$1"

    for log in "$log_dir"/*.log; do
        [ -f "$log" ] || continue

        local size_kb=$(du -k "$log" 2>/dev/null | cut -f1)
        local size_mb=$((size_kb / 1024))

        if [ "$size_mb" -ge "$MAX_LOG_SIZE_MB" ]; then
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local backup="${log%.*}.${timestamp}.bak"
            mv "$log" "$backup"
            gzip "$backup" 2>/dev/null || true

            local backups=($(ls -t "${log%.*}".*.bak.gz 2>/dev/null || true))
            if [ ${#backups[@]} -gt "$MAX_LOG_BACKUPS" ]; then
                for ((i=MAX_LOG_BACKUPS; i<${#backups[@]}; i++)); do
                    rm -f "${backups[$i]}"
                done
            fi

            touch "$log"
            log "Log rotated from $backup"
        fi
    done
}

record_stats() {
    local stats_file="$LOG_DIR/deploy_stats.json"
    local status="$1"
    local duration="$2"
    local commit="${3:-unknown}"
    local issues="${4:-}"

    local stat_entry=$(cat <<EOF
{"timestamp":"$(date -Iseconds)","status":"$status","duration":$duration,"commit":"$commit","issues":"$issues"}
EOF
)
    echo "$stat_entry" >> "$stats_file"

    local lines=$(wc -l < "$stats_file" 2>/dev/null || echo "0")
    if [ "$lines" -gt "$MAX_DEPLOY_STATS" ]; then
        tail -$MAX_DEPLOY_STATS "$stats_file" > "${stats_file}.tmp"
        mv "${stats_file}.tmp" "$stats_file"
    fi
}

save_version() {
    local version_file="$STATE_DIR/version.json"
    local commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

    cat > "$version_file" <<EOF
{
  "commit": "$commit",
  "deployed_at": "$(date '+%Y-%m-%d %H:%M:%S')"
}
EOF
    log "Version saved: $commit"
}

get_current_version() {
    local version_file="$STATE_DIR/version.json"
    if [ -f "$version_file" ]; then
        grep -o '"commit": "[^"]*"' "$version_file" | cut -d'"' -f4
    else
        echo "unknown"
    fi
}

save_last_success_version() {
    local commit=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ -n "$commit" ]; then
        echo "$commit" > "$STATE_DIR/last_success.commit"
        log "Last success version saved: $commit"
    fi
}

get_last_success_version() {
    local file="$STATE_DIR/last_success.commit"
    if [ -f "$file" ]; then
        cat "$file"
    else
        echo ""
    fi
}

rollback_to_last_success() {
    local last_commit=$(get_last_success_version)
    if [ -z "$last_commit" ]; then
        log "No last success version found, cannot rollback"
        return 1
    fi

    log "Rolling back to commit: $last_commit"
    git reset --hard "$last_commit" 2>&1 | log_output
    if [ $? -ne 0 ]; then
        log "Rollback failed"
        return 1
    fi

    log "Rollback successful"
    return 0
}

validate_env() {
    local missing=()

    if [ -z "${DATABASE_URL:-}" ]; then
        missing+=("DATABASE_URL")
    fi
    if [ -z "${RESEND_API_KEY:-}" ]; then
        missing+=("RESEND_API_KEY")
    fi
    if [ -z "${EMAIL_FROM:-}" ]; then
        missing+=("EMAIL_FROM")
    fi
    if [ -z "${EMAIL_TO:-}" ]; then
        missing+=("EMAIL_TO")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        log "Missing required env vars: ${missing[*]}"
        return 1
    fi
    return 0
}

check_service_health() {
    local max_retries=30
    local retry=0

    log "Checking service health on port $PORT..."

    while [ $retry -lt $max_retries ]; do
        if curl -sf "http://localhost:$PORT/" > /dev/null 2>&1; then
            log "Service health check passed"
            return 0
        fi
        sleep 1
        ((retry++))
    done

    log "Service health check failed after ${max_retries}s"
    return 1
}

log() {
    local log_file="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$log_file"
}

log_output() {
    while IFS= read -r line; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line"
    done
}

load_env_file() {
    if [ -f "$APP_DIR/.env" ]; then
        set -a
        source "$APP_DIR/.env"
        set +a
    fi
}

get_last_status() {
    local file="$STATE_DIR/.last_deploy_status"
    if [ -f "$file" ]; then
        cat "$file"
    else
        echo "unknown"
    fi
}

save_status() {
    echo "$1" > "$STATE_DIR/.last_deploy_status"
}

should_send_failure_notification() {
    local last_status=$(get_last_status)
    [ "$last_status" != "failed" ]
}

notify() {
    local log_file="$1"
    local status="$2"
    local message="$3"
    local commit_title="${4:-}"
    local commit_body="${5:-}"
    local changed_files="${6:-}"
    local extra_details="${7:-}"

    if [ "$status" = "error" ] && ! should_send_failure_notification; then
        log "$log_file" "Failure notification suppressed (already notified)"
        save_status "failed"
        return 0
    fi

    send_deployment_notification "$log_file" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details"
    save_status "$status"
}

send_email() {
    local log_file="$1"
    shift

    if python3 "$SCRIPT_DIR/send_email.py" "$@" >> "$log_file" 2>&1; then
        log "$log_file" "Email sent: $1"
    else
        log "$log_file" "Email failed: $1"
    fi
}

send_deployment_notification() {
    local log_file="$1"
    local status="$2"
    local message="$3"
    local commit_title="$4"
    local commit_body="$5"
    local changed_files="$6"
    local extra_details="$7"

    local status_text="成功"
    if [ "$status" = "error" ]; then
        status_text="失败"
    elif [ "$status" = "warning" ]; then
        status_text="警告"
    elif [ "$status" = "health_repaired" ]; then
        status_text="自愈"
    fi

    local current_version=$(get_current_version)

    send_email "$log_file" "SD-UI 部署${status_text}" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details" "$current_version"
}

backup_database() {
    local db_path="$APP_DIR/prisma/dev.db"
    if [ -f "$db_path" ]; then
        local backup_name="dev.db.$(date '+%Y%m%d_%H%M%S').backup"
        local backup_path="$BACKUP_DIR/$backup_name"
        cp "$db_path" "$backup_path"
        log "$LOG_DIR/hot-deploy.log" "Database backed up to: $backup_path"

        local old_backups=($(ls -t "$BACKUP_DIR"/dev.db.*.backup 2>/dev/null || true))
        if [ ${#old_backups[@]} -gt "$MAX_DB_BACKUPS" ]; then
            for ((i=MAX_DB_BACKUPS; i<${#old_backups[@]}; i++)); do
                rm -f "${old_backups[$i]}"
                log "$LOG_DIR/hot-deploy.log" "Removed old backup: ${old_backups[$i]}"
            done
        fi
    fi
}

wait_for_processing_tasks() {
    local elapsed=0
    log "$LOG_DIR/hot-deploy.log" "Checking for processing tasks..."

    local db_path="$APP_DIR/prisma/dev.db"

    while true; do
        local processing_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM Task WHERE status='processing';" 2>/dev/null || echo "0")

        if [ "$processing_count" -eq 0 ]; then
            log "$LOG_DIR/hot-deploy.log" "No processing tasks, safe to proceed"
            return 0
        fi

        log "$LOG_DIR/hot-deploy.log" "Waiting for $processing_count processing task(s) to complete (elapsed: ${elapsed}s)..."

        if [ "$elapsed" -ge "$SHUTDOWN_TIMEOUT" ]; then
            log "$LOG_DIR/hot-deploy.log" "Timeout reached, resetting processing tasks to pending..."
            sqlite3 "$db_path" "UPDATE Task SET status='pending' WHERE status='processing';" 2>/dev/null || true
            log "$LOG_DIR/hot-deploy.log" "Processing tasks reset to pending, they will be retried after restart"
            return 0
        fi

        sleep 5
        elapsed=$((elapsed + 5))
    done
}

ensure_scripts_executable() {
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
}

check_dependencies_changed() {
    local old_hash="$1"
    local new_hash="$2"

    local changed_files=$(git diff --name-only "$old_hash" "$new_hash" 2>/dev/null || echo "")
    for file in $changed_files; do
        case "$file" in
            ui/package.json|ui/package-lock.json|ui/yarn.lock|ui/pnpm-lock.yaml)
                return 0
                ;;
        esac
    done
    return 1
}
