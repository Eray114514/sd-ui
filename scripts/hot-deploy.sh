#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

load_config
LOG_FILE="$LOG_DIR/hot-deploy.log"
HEALTH_CHECK_LOG="$LOG_DIR/health-check.log"

acquire_lock "hot-deploy"
rotate_logs "$LOG_DIR"

START_TIME=$(date +%s)
PREVIOUS_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

load_env_file

if ! validate_env; then
    notify "$LOG_FILE" "error" "环境变量缺失" "缺少必要的环境变量，请检查 .env 文件" "" "" ""
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
        local db_path="${DATABASE_URL#file:}"
        if [ ! -f "$db_path" ] && [ ! -f "$APP_DIR/$db_path" ]; then
            issues+=("database missing")
            echo "[Health] database missing, need db push" >> "$HEALTH_CHECK_LOG"
        elif ! npx prisma migrate status >> "$HEALTH_CHECK_LOG" 2>&1; then
            issues+=("prisma migration pending")
            echo "[Health] prisma migration pending or failed" >> "$HEALTH_CHECK_LOG"
        fi
        cd "$REPO_DIR"
    fi

    if [ ${#issues[@]} -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check passed" >> "$HEALTH_CHECK_LOG"
        return 0
    fi

    log "$LOG_FILE" "Health check found issues: ${issues[*]}"

    local need_rebuild=false
    local need_migrate=false
    local need_db_push=false

    for issue in "${issues[@]}"; do
        case "$issue" in
            "node_modules missing"|"standalone build missing")
                need_rebuild=true
                ;;
            "prisma migration pending")
                need_migrate=true
                ;;
            "database missing")
                need_db_push=true
                ;;
        esac
    done

    if [ "$need_rebuild" = true ]; then
        log "$LOG_FILE" "Health repair: Running full rebuild..."
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
        log "$LOG_FILE" "Health repair: Rebuild complete"
    else
        if [ ! -d "$standalone_dir" ]; then
            log "$LOG_FILE" "Health repair: standalone dir not found, skipping file sync"
            return 1
        fi

        for issue in "${issues[@]}"; do
            case "$issue" in
                "static files missing")
                    log "$LOG_FILE" "Health repair: Syncing static files..."
                    mkdir -p "$static_dest"
                    cp -r "$static_src/"* "$static_dest/" 2>/dev/null || true
                    ;;
                "public files missing")
                    log "$LOG_FILE" "Health repair: Syncing public files..."
                    mkdir -p "$public_dest"
                    cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
                    ;;
            esac
        done
    fi

    if [ "$need_db_push" = true ]; then
        log "$LOG_FILE" "Health repair: Running prisma db push..."
        cd "$APP_DIR"
        npx prisma db push >> "$HEALTH_CHECK_LOG" 2>&1 || true
        cd "$REPO_DIR"
        log "$LOG_FILE" "Health repair: Database push complete"
    fi

    if [ "$need_migrate" = true ]; then
        log "$LOG_FILE" "Health repair: Running prisma migrate deploy..."
        cd "$APP_DIR"
        npx prisma migrate deploy >> "$HEALTH_CHECK_LOG" 2>&1 || true
        cd "$REPO_DIR"
        log "$LOG_FILE" "Health repair: Migration complete"
    fi

    if [ "$need_rebuild" = true ] || [ "$need_migrate" = true ] || [ "$need_db_push" = true ]; then
        log "$LOG_FILE" "Health repair: Restarting service..."
        systemctl --user restart "$SERVICE_NAME" 2>/dev/null || true
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Health Check End (Repaired) ===" >> "$HEALTH_CHECK_LOG"

    HEALTH_ISSUES="${issues[*]}"
    return 0
}

health_check

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
    local status="$1"
    local message="$2"
    local commit_title="${3:-}"
    local commit_body="${4:-}"
    local changed_files="${5:-}"
    local extra_details="${6:-}"

    if [ "$status" = "error" ] && ! should_send_failure_notification; then
        log "$LOG_FILE" "Failure notification suppressed (already notified)"
        save_status "failed"
        return 0
    fi

    send_deployment_notification "$LOG_FILE" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details"
    save_status "$status"
}

detect_and_install_nodejs() {
    if ! command -v node &> /dev/null; then
        log "$LOG_FILE" "Node.js not found, attempting to install..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || true
            apt-get install -y nodejs >> "$LOG_FILE" 2>&1 || true
        fi
    fi

    if command -v node &> /dev/null; then
        log "$LOG_FILE" "Node.js version: $(node --version)"
    else
        log "$LOG_FILE" "WARNING: Node.js installation failed"
    fi
}

detect_and_install_npm_deps() {
    detect_and_install_nodejs

    if ! command -v npm &> /dev/null; then
        log "$LOG_FILE" "npm not found, installing..."
        if command -v apt-get &> /dev/null; then
            apt-get install -y npm >> "$LOG_FILE" 2>&1 || true
        fi
    fi
}

install_prisma_if_needed() {
    local prisma_version=$(grep '"prisma"' "$APP_DIR/package.json" 2>/dev/null | head -1 | sed 's/[^0-9.]//g' || echo "")

    if [ -n "$prisma_version" ]; then
        local current_prisma=$(npx prisma --version 2>/dev/null | head -1 || echo "")
        log "$LOG_FILE" "Current Prisma: $current_prisma"

        if ! echo "$current_prisma" | grep -q "$prisma_version"; then
            log "$LOG_FILE" "Prisma version mismatch, installing correct version..."
            npm install prisma@"$prisma_version" @prisma/client@"$prisma_version" >> "$LOG_FILE" 2>&1
        fi
    fi
}

run_npm_install() {
    log "$LOG_FILE" "Installing dependencies..."
    npm install >> "$LOG_FILE" 2>&1
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log "$LOG_FILE" "npm install failed with exit code $exit_code, retrying..."

        if [ -f "$APP_DIR/package-lock.json" ]; then
            log "$LOG_FILE" "Removing package-lock.json and retrying..."
            rm -f "$APP_DIR/package-lock.json"
        fi

        npm install >> "$LOG_FILE" 2>&1
        exit_code=$?

        if [ $exit_code -ne 0 ]; then
            log "$LOG_FILE" "npm install retry failed"
            return $exit_code
        fi
    fi

    install_prisma_if_needed
    return 0
}

run_prisma_generate() {
    log "$LOG_FILE" "Generating Prisma client..."
    npx prisma generate >> "$LOG_FILE" 2>&1
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log "$LOG_FILE" "Prisma generate failed, trying to fix..."

        if [ -f "$APP_DIR/node_modules/.prisma/client" ]; then
            rm -rf "$APP_DIR/node_modules/.prisma"
        fi

        npx prisma generate >> "$LOG_FILE" 2>&1
        exit_code=$?
    fi

    return $exit_code
}

run_prisma_migrate() {
    log "$LOG_FILE" "Running database migrations..."
    cd "$APP_DIR"

    if [ -d "$APP_DIR/prisma/migrations" ] && [ -n "$(ls -A "$APP_DIR/prisma/migrations" 2>/dev/null)" ]; then
        npx prisma migrate deploy >> "$LOG_FILE" 2>&1
        local exit_code=$?

        if [ $exit_code -ne 0 ]; then
            log "$LOG_FILE" "Migration failed, attempting to resolve..."
            npx prisma migrate resolve --applied 2>&1 | tee -a "$LOG_FILE" || true
        fi
    else
        log "$LOG_FILE" "No migrations folder found, using db push instead..."
        npx prisma db push >> "$LOG_FILE" 2>&1
        local exit_code=$?
    fi

    cd "$REPO_DIR"
    return $exit_code
}

sync_public_files() {
    local standalone_dir="$APP_DIR/.next/standalone"
    local public_src="$APP_DIR/public"
    local public_dest="$standalone_dir/public"

    if [ ! -d "$standalone_dir" ]; then
        log "$LOG_FILE" "Standalone directory not found, skipping public sync"
        return
    fi

    if [ ! -d "$public_src" ]; then
        log "$LOG_FILE" "Public directory not found, skipping public sync"
        return
    fi

    mkdir -p "$public_dest"
    cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
    log "$LOG_FILE" "Public files synced to: $public_dest"
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
        log "$LOG_FILE" "No lock file found, skipping commit"
        return
    fi

    if git diff --quiet "$lock_file" 2>/dev/null; then
        log "$LOG_FILE" "Lock file unchanged, skipping commit"
        return
    fi

    log "$LOG_FILE" "Lock file changed, committing and pushing..."
    git add "$lock_file"
    git commit -m "chore(deps): update lock file

Updated by hot-deploy.sh" >> "$LOG_FILE" 2>&1 || {
        log "$LOG_FILE" "Failed to commit lock file"
        return
    }

    git push "origin/$GIT_BRANCH" >> "$LOG_FILE" 2>&1 || {
        log "$LOG_FILE" "Failed to push lock file, will retry next deployment"
        git reset --soft HEAD~1 2>/dev/null || true
        return
    }

    log "$LOG_FILE" "Lock file committed and pushed successfully"
}

DEPLOY_RESULT="success"
DEPLOY_MESSAGE="热部署完成"
DEPLOY_DETAILS=""

log "$LOG_FILE" "=== Starting hot deployment ==="

cd "$APP_DIR"

log "$LOG_FILE" "Pulling latest version..."
git pull "origin/$GIT_BRANCH" --ff-only >> "$LOG_FILE" 2>&1 || {
    log "$LOG_FILE" "Pull failed, attempting hard reset..."
    git reset --hard "origin/$GIT_BRANCH" >> "$LOG_FILE" 2>&1 || true
}

log "$LOG_FILE" "Backing up database..."
backup_database

detect_and_install_npm_deps

if [ -n "$PREVIOUS_COMMIT" ]; then
    if check_dependencies_changed "$PREVIOUS_COMMIT" HEAD; then
        log "$LOG_FILE" "Dependencies changed, running npm install..."
        if ! run_npm_install; then
            DEPLOY_RESULT="error"
            DEPLOY_MESSAGE="依赖安装失败"
            DEPLOY_DETAILS="npm install 失败，请检查日志: $LOG_FILE"
            log "$LOG_FILE" "ERROR: npm install failed after retry"
            notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
            exit 1
        fi
    else
        log "$LOG_FILE" "Dependencies unchanged, skipping npm install"
    fi
else
    if ! run_npm_install; then
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="依赖安装失败"
        DEPLOY_DETAILS="npm install 失败，请检查日志: $LOG_FILE"
        log "$LOG_FILE" "ERROR: npm install failed after retry"
        notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
        exit 1
    fi
fi

if ! run_prisma_generate; then
    DEPLOY_RESULT="error"
    DEPLOY_MESSAGE="Prisma 生成失败"
    DEPLOY_DETAILS="npx prisma generate 失败，请检查日志: $LOG_FILE"
    log "$LOG_FILE" "ERROR: Prisma generate failed"
    notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
    exit 1
fi

run_prisma_migrate

log "$LOG_FILE" "Building..."
npm run build >> "$LOG_FILE" 2>&1
build_exit_code=$?

if [ $build_exit_code -ne 0 ]; then
    log "$LOG_FILE" "WARNING: Build exited with code $build_exit_code"

    if grep -q "Module not found" "$LOG_FILE"; then
        log "$LOG_FILE" "Module not found error detected, cleaning node_modules and retrying..."
        rm -rf "$APP_DIR/node_modules"
        npm install >> "$LOG_FILE" 2>&1
        npm run build >> "$LOG_FILE" 2>&1
        build_exit_code=$?
    fi

    if [ $build_exit_code -ne 0 ]; then
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="构建失败"
        DEPLOY_DETAILS="npm run build 失败 (退出码: $build_exit_code)，请检查日志: $LOG_FILE"
        log "$LOG_FILE" "ERROR: Build failed after retry"
        notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
        exit 1
    fi
fi

sync_public_files

commit_lock_file

log "$LOG_FILE" "Waiting for current processing tasks before restart..."
wait_for_processing_tasks

log "$LOG_FILE" "Restarting service..."
systemctl --user restart "$SERVICE_NAME" 2>/dev/null || {
    log "$LOG_FILE" "WARNING: systemctl restart failed, trying alternative..."
    systemctl --user restart "$SERVICE_NAME" || true
}

sleep 3

if check_service_health; then
    DEPLOY_DETAILS="所有步骤执行成功，服务已重启并通过健康检查"
    save_last_success_version
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

log "$LOG_FILE" "=== Hot deployment complete (duration: ${DURATION}s) ==="
notify "$DEPLOY_RESULT" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
