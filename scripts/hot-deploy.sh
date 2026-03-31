#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
LOG_FILE="$LOG_DIR/hot-deploy.log"
HEALTH_CHECK_LOG="$LOG_DIR/health-check.log"
BACKUP_DIR="${HOME}/.local/share/sd-ui/backups"
LOCK_FILE="/tmp/sd-ui-hot-deploy.lock"
VERSION_FILE="$LOG_DIR/.current_version"
STATS_FILE="$LOG_DIR/deploy_stats.json"
LAST_STATUS_FILE="$LOG_DIR/.last_deploy_status"
SHUTDOWN_TIMEOUT=30

mkdir -p "$LOG_DIR"
mkdir -p "$BACKUP_DIR"

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "Another instance is running (PID: $pid), exiting"
            exit 0
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
    trap "rm -f $LOCK_FILE" EXIT
}

rotate_logs() {
    local max_size_mb=10
    local max_backups=5
    
    for log in "$LOG_DIR"/*.log; do
        [ -f "$log" ] || continue
        
        local size_kb=$(du -k "$log" 2>/dev/null | cut -f1)
        local size_mb=$((size_kb / 1024))
        
        if [ "$size_mb" -ge "$max_size_mb" ]; then
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local backup="${log%.*}.${timestamp}.bak"
            mv "$log" "$backup"
            gzip "$backup" 2>/dev/null || true
            
            local backups=($(ls -t "${log%.*}".*.bak.gz 2>/dev/null || true))
            if [ ${#backups[@]} -gt "$max_backups" ]; then
                for ((i=max_backups; i<${#backups[@]}; i++)); do
                    rm -f "${backups[$i]}"
                done
            fi
            
            touch "$log"
            log "Log rotated from $backup"
        fi
    done
}

record_stats() {
    local status="$1"
    local duration="$2"
    local commit="${3:-unknown}"
    local issues="${4:-}"
    
    local stat_entry=$(cat <<EOF
{"timestamp":"$(date -Iseconds)","status":"$status","duration":$duration,"commit":"$commit","issues":"$issues"}
EOF
)
    echo "$stat_entry" >> "$STATS_FILE"
    
    local lines=$(wc -l < "$STATS_FILE" 2>/dev/null || echo "0")
    if [ "$lines" -gt 100 ]; then
        tail -100 "$STATS_FILE" > "${STATS_FILE}.tmp"
        mv "${STATS_FILE}.tmp" "$STATS_FILE"
    fi
}

save_version() {
    local commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    echo "$commit" > "$VERSION_FILE"
    log "Version saved: $commit"
}

get_current_version() {
    cat "$VERSION_FILE" 2>/dev/null || echo "unknown"
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
    local port="${PORT:-3001}"
    
    log "Checking service health on port $port..."
    
    while [ $retry -lt $max_retries ]; do
        if curl -sf "http://localhost:$port/" > /dev/null 2>&1; then
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
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

acquire_lock
rotate_logs

START_TIME=$(date +%s)

if [ -f "$APP_DIR/.env" ]; then
    set -a
    source "$APP_DIR/.env"
    set +a
fi

if ! validate_env; then
    notify "error" "环境变量缺失" "缺少必要的环境变量，请检查 .env 文件" "" "" ""
    exit 1
fi

HEALTH_ISSUES=""

health_check() {
    local issues=()
    local standalone_dir="$APP_DIR/.next/standalone"
    local static_src="$APP_DIR/.next/static"
    local static_dest="$standalone_dir/.next/static"
    local public_src="$APP_DIR/public"
    local public_dest="$standalone_dir/public"

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Health Check Start ===" >> "$HEALTH_CHECK_LOG"

    if [ ! -d "$APP_DIR/node_modules" ]; then
        issues+=("node_modules missing")
        echo "[Health] node_modules missing" >> "$HEALTH_CHECK_LOG"
    fi

    if [ ! -f "$standalone_dir/server.js" ]; then
        issues+=("standalone build missing")
        echo "[Health] standalone build missing" >> "$HEALTH_CHECK_LOG"
    fi

    if [ -d "$static_src" ]; then
        if [ ! -d "$static_dest" ] || [ -z "$(ls -A "$static_dest" 2>/dev/null)" ]; then
            issues+=("static files missing")
            echo "[Health] static files missing in standalone" >> "$HEALTH_CHECK_LOG"
        fi
    fi

    if [ -d "$public_src" ]; then
        if [ ! -d "$public_dest" ] || [ -z "$(ls -A "$public_dest" 2>/dev/null)" ]; then
            issues+=("public files missing")
            echo "[Health] public files missing in standalone" >> "$HEALTH_CHECK_LOG"
        fi
    fi

    if [ -f "$APP_DIR/prisma/schema.prisma" ]; then
        cd "$APP_DIR"
        if ! npx prisma migrate status >> "$HEALTH_CHECK_LOG" 2>&1; then
            issues+=("prisma migration pending")
            echo "[Health] prisma migration pending or failed" >> "$HEALTH_CHECK_LOG"
        fi
        cd "$REPO_DIR"
    fi

    if [ ${#issues[@]} -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check passed" >> "$HEALTH_CHECK_LOG"
        return 0
    fi

    log "Health check found issues: ${issues[*]}"

    local need_rebuild=false
    local need_migrate=false

    for issue in "${issues[@]}"; do
        case "$issue" in
            "node_modules missing"|"standalone build missing")
                need_rebuild=true
                ;;
            "prisma migration pending")
                need_migrate=true
                ;;
        esac
    done

    if [ "$need_rebuild" = true ]; then
        log "Health repair: Running full rebuild..."
        cd "$APP_DIR"
        npm install >> "$HEALTH_CHECK_LOG" 2>&1 || true
        npx prisma generate >> "$HEALTH_CHECK_LOG" 2>&1 || true
        npm run build >> "$HEALTH_CHECK_LOG" 2>&1 || true

        if [ -f "$APP_DIR/scripts/sync-standalone-static.mjs" ]; then
            node "$APP_DIR/scripts/sync-standalone-static.mjs" >> "$HEALTH_CHECK_LOG" 2>&1 || true
        fi

        if [ -d "$public_src" ] && [ -d "$standalone_dir" ]; then
            mkdir -p "$public_dest"
            cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
        fi
        cd "$REPO_DIR"
        log "Health repair: Rebuild complete"
    else
        if [ ! -d "$standalone_dir" ]; then
            log "Health repair: standalone dir not found, skipping file sync"
            return 1
        fi

        for issue in "${issues[@]}"; do
            case "$issue" in
                "static files missing")
                    log "Health repair: Syncing static files..."
                    mkdir -p "$static_dest"
                    cp -r "$static_src/"* "$static_dest/" 2>/dev/null || true
                    ;;
                "public files missing")
                    log "Health repair: Syncing public files..."
                    mkdir -p "$public_dest"
                    cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
                    ;;
            esac
        done
    fi

    if [ "$need_migrate" = true ]; then
        log "Health repair: Running prisma migrate deploy..."
        cd "$APP_DIR"
        npx prisma migrate deploy >> "$HEALTH_CHECK_LOG" 2>&1 || true
        cd "$REPO_DIR"
        log "Health repair: Migration complete"
    fi

    if [ "$need_rebuild" = true ] || [ "$need_migrate" = true ]; then
        log "Health repair: Restarting service..."
        systemctl --user restart sd-ui 2>/dev/null || true
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Health Check End (Repaired) ===" >> "$HEALTH_CHECK_LOG"
    
    HEALTH_ISSUES="${issues[*]}"
    return 0
}

health_check

get_last_status() {
    if [ -f "$LAST_STATUS_FILE" ]; then
        cat "$LAST_STATUS_FILE"
    else
        echo "unknown"
    fi
}

save_status() {
    echo "$1" > "$LAST_STATUS_FILE"
}

should_send_failure_notification() {
    local last_status=$(get_last_status)
    [ "$last_status" != "failed" ]
}

notify() {
    local status="$1"
    local message="$2"
    local commit_title="${3:-}"
    local commit_body="${4:-}"
    local changed_files="${5:-}"
    local extra_details="${6:-}"

    if [ "$status" = "error" ] && ! should_send_failure_notification; then
        log "Failure notification suppressed (already notified)"
        save_status "failed"
        return 0
    fi

    send_deployment_notification "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details"
    save_status "$status"
}

send_email() {
    local subject="$1"
    local status="$2"
    local message="$3"
    local commit_title="$4"
    local commit_body="$5"
    local changed_files="$6"
    local extra_details="$7"
    local current_version="$8"

    if python3 "$SCRIPT_DIR/send_email.py" "$subject" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details" "$current_version" >> "$LOG_FILE" 2>&1; then
        log "Email sent: $subject"
    else
        log "Email failed: $subject"
    fi
}

send_deployment_notification() {
    local status="$1"
    local message="$2"
    local commit_title="$3"
    local commit_body="$4"
    local changed_files="$5"
    local extra_details="$6"

    local status_text="成功"
    if [ "$status" = "error" ]; then
        status_text="失败"
    elif [ "$status" = "warning" ]; then
        status_text="警告"
    elif [ "$status" = "health_repaired" ]; then
        status_text="自愈"
    fi

    local current_version=$(get_current_version)

    send_email "SD-UI 热部署${status_text}" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details" "$current_version"
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

detect_and_install_nodejs() {
    if ! command -v node &> /dev/null; then
        log "Node.js not found, attempting to install..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || true
            apt-get install -y nodejs >> "$LOG_FILE" 2>&1 || true
        fi
    fi

    if command -v node &> /dev/null; then
        log "Node.js version: $(node --version)"
    else
        log "WARNING: Node.js installation failed"
    fi
}

detect_and_install_npm_deps() {
    detect_and_install_nodejs

    if ! command -v npm &> /dev/null; then
        log "npm not found, installing..."
        if command -v apt-get &> /dev/null; then
            apt-get install -y npm >> "$LOG_FILE" 2>&1 || true
        fi
    fi
}

install_prisma_if_needed() {
    local prisma_version=$(grep '"prisma"' "$APP_DIR/package.json" 2>/dev/null | head -1 | sed 's/[^0-9.]//g' || echo "")

    if [ -n "$prisma_version" ]; then
        local current_prisma=$(npx prisma --version 2>/dev/null | head -1 || echo "")
        log "Current Prisma: $current_prisma"

        if ! echo "$current_prisma" | grep -q "$prisma_version"; then
            log "Prisma version mismatch, installing correct version..."
            npm install prisma@"$prisma_version" @prisma/client@"$prisma_version" >> "$LOG_FILE" 2>&1
        fi
    fi
}

run_npm_install() {
    log "Installing dependencies..."
    npm install >> "$LOG_FILE" 2>&1
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log "npm install failed with exit code $exit_code, retrying..."

        if [ -f "$APP_DIR/package-lock.json" ]; then
            log "Removing package-lock.json and retrying..."
            rm -f "$APP_DIR/package-lock.json"
        fi

        npm install >> "$LOG_FILE" 2>&1
        exit_code=$?

        if [ $exit_code -ne 0 ]; then
            log "npm install retry failed"
            return $exit_code
        fi
    fi

    install_prisma_if_needed
    return 0
}

run_prisma_generate() {
    log "Generating Prisma client..."
    npx prisma generate >> "$LOG_FILE" 2>&1
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log "Prisma generate failed, trying to fix..."

        if [ -f "$APP_DIR/node_modules/.prisma/client" ]; then
            rm -rf "$APP_DIR/node_modules/.prisma"
        fi

        npx prisma generate >> "$LOG_FILE" 2>&1
        exit_code=$?
    fi

    return $exit_code
}

run_prisma_migrate() {
    log "Running database migrations..."

    if [ -d "$APP_DIR/prisma/migrations" ] && [ -n "$(ls -A "$APP_DIR/prisma/migrations" 2>/dev/null)" ]; then
        npx prisma migrate deploy >> "$LOG_FILE" 2>&1
        local exit_code=$?

        if [ $exit_code -ne 0 ]; then
            log "Migration failed, attempting to resolve..."
            npx prisma migrate resolve --applied 2>&1 | tee -a "$LOG_FILE" || true
        fi
    else
        log "No migrations directory found or empty, running db push instead..."
        DATABASE_URL="file:./prisma/dev.db" npx prisma db push >> "$LOG_FILE" 2>&1 || true
    fi
}

DEPLOY_RESULT="success"
DEPLOY_MESSAGE="热部署完成"
DEPLOY_DETAILS=""

log "=== Starting hot deployment ==="

cd "$APP_DIR"

log "Pulling latest version..."
git pull origin main --ff-only >> "$LOG_FILE" 2>&1 || {
    log "Pull failed, attempting hard reset..."
    git reset --hard origin/main >> "$LOG_FILE" 2>&1 || true
}

log "Backing up database..."
backup_database

detect_and_install_npm_deps

if ! run_npm_install; then
    DEPLOY_RESULT="error"
    DEPLOY_MESSAGE="依赖安装失败"
    DEPLOY_DETAILS="npm install 失败，请检查日志: $LOG_FILE"
    log "ERROR: npm install failed after retry"
    notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
    exit 1
fi

if ! run_prisma_generate; then
    DEPLOY_RESULT="error"
    DEPLOY_MESSAGE="Prisma 生成失败"
    DEPLOY_DETAILS="npx prisma generate 失败，请检查日志: $LOG_FILE"
    log "ERROR: Prisma generate failed"
    notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
    exit 1
fi

run_prisma_migrate

log "Building..."
npm run build >> "$LOG_FILE" 2>&1
build_exit_code=$?

if [ $build_exit_code -ne 0 ]; then
    log "WARNING: Build exited with code $build_exit_code"

    if grep -q "Module not found" "$LOG_FILE"; then
        log "Module not found error detected, cleaning node_modules and retrying..."
        rm -rf "$APP_DIR/node_modules"
        npm install >> "$LOG_FILE" 2>&1
        npm run build >> "$LOG_FILE" 2>&1
        build_exit_code=$?
    fi

    if [ $build_exit_code -ne 0 ]; then
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="构建失败"
        DEPLOY_DETAILS="npm run build 失败 (退出码: $build_exit_code)，请检查日志: $LOG_FILE"
        log "ERROR: Build failed after retry"
        notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
        exit 1
    fi
fi

sync_public_files() {
    local standalone_dir="$APP_DIR/.next/standalone"
    local public_src="$APP_DIR/public"
    local public_dest="$standalone_dir/public"

    if [ ! -d "$standalone_dir" ]; then
        log "Standalone directory not found, skipping public sync"
        return
    fi

    if [ ! -d "$public_src" ]; then
        log "Public directory not found, skipping public sync"
        return
    fi

    mkdir -p "$public_dest"
    cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
    log "Public files synced to: $public_dest"
}

commit_lock_file() {
    local lock_file=""
    if [ -f "$APP_DIR/package-lock.json" ]; then
        lock_file="package-lock.json"
    elif [ -f "$APP_DIR/yarn.lock" ]; then
        lock_file="yarn.lock"
    elif [ -f "$APP_DIR/pnpm-lock.yaml" ]; then
        lock_file="pnpm-lock.yaml"
    fi

    if [ -z "$lock_file" ]; then
        log "No lock file found, skipping commit"
        return
    fi

    if git diff --quiet "$lock_file" 2>/dev/null; then
        log "Lock file unchanged, skipping commit"
        return
    fi

    log "Lock file changed, committing and pushing..."
    git add "$lock_file"
    git commit -m "chore(deps): update lock file

Updated by hot-deploy.sh" >> "$LOG_FILE" 2>&1 || {
        log "Failed to commit lock file"
        return
    }

    git push origin main >> "$LOG_FILE" 2>&1 || {
        log "Failed to push lock file, will retry next deployment"
        git reset --soft HEAD~1 2>/dev/null || true
        return
    }

    log "Lock file committed and pushed successfully"
}

sync_public_files

commit_lock_file

log "Waiting for current processing tasks before restart..."
wait_for_processing_tasks 0

log "Restarting service..."
systemctl --user restart sd-ui 2>/dev/null || {
    log "WARNING: systemctl restart failed, trying alternative..."
    systemctl --user restart sd-ui || true
}

sleep 3

if check_service_health; then
    DEPLOY_DETAILS="所有步骤执行成功，服务已重启并通过健康检查"
else
    DEPLOY_RESULT="warning"
    DEPLOY_MESSAGE="热部署完成（服务健康检查未通过）"
    DEPLOY_DETAILS="服务已重启但健康检查未通过，请手动检查服务状态"
fi

if [ -n "$HEALTH_ISSUES" ]; then
    DEPLOY_DETAILS="$DEPLOY_DETAILS | 健康检查修复的问题: $HEALTH_ISSUES"
fi

save_version

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

record_stats "$DEPLOY_RESULT" "$DURATION" "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" "$HEALTH_ISSUES"

log "=== Hot deployment complete (duration: ${DURATION}s) ==="
notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
