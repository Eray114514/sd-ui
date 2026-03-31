#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
GIT_LOG="$LOG_DIR/git-pull.log"
HEALTH_CHECK_LOG="$LOG_DIR/health-check.log"
LOCK_FILE="/tmp/sd-ui-check-git.lock"
VERSION_FILE="$LOG_DIR/.current_version"
STATS_FILE="$LOG_DIR/deploy_stats.json"
LATEST_HASH_FILE="$LOG_DIR/.last_commit_hash"
LAST_STATUS_FILE="$LOG_DIR/.last_deploy_status"

mkdir -p "$LOG_DIR"

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another instance is running (PID: $pid), exiting" >> "$GIT_LOG"
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
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Log rotated from $backup" >> "$log"
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
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Version saved: $commit" >> "$GIT_LOG"
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
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Missing required env vars: ${missing[*]}" >> "$GIT_LOG"
        return 1
    fi
    return 0
}

check_service_health() {
    local max_retries=30
    local retry=0
    local port="${PORT:-3001}"
    
    while [ $retry -lt $max_retries ]; do
        if curl -sf "http://localhost:$port/" > /dev/null 2>&1; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Service health check passed" >> "$HEALTH_CHECK_LOG"
            return 0
        fi
        sleep 1
        ((retry++))
    done
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Service health check failed after ${max_retries}s" >> "$HEALTH_CHECK_LOG"
    return 1
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

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check found issues: ${issues[*]}" >> "$HEALTH_CHECK_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check found issues: ${issues[*]}" >> "$GIT_LOG"

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
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Running full rebuild..." >> "$GIT_LOG"
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
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Rebuild complete" >> "$GIT_LOG"
    else
        if [ ! -d "$standalone_dir" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: standalone dir not found, skipping file sync" >> "$GIT_LOG"
            return 1
        fi

        for issue in "${issues[@]}"; do
            case "$issue" in
                "static files missing")
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Syncing static files..." >> "$GIT_LOG"
                    mkdir -p "$static_dest"
                    cp -r "$static_src/"* "$static_dest/" 2>/dev/null || true
                    ;;
                "public files missing")
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Syncing public files..." >> "$GIT_LOG"
                    mkdir -p "$public_dest"
                    cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
                    ;;
            esac
        done
    fi

    if [ "$need_migrate" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Running prisma migrate deploy..." >> "$GIT_LOG"
        cd "$APP_DIR"
        npx prisma migrate deploy >> "$HEALTH_CHECK_LOG" 2>&1 || true
        cd "$REPO_DIR"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Migration complete" >> "$GIT_LOG"
    fi

    if [ "$need_rebuild" = true ] || [ "$need_migrate" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Restarting service..." >> "$GIT_LOG"
        systemctl --user restart sd-ui 2>/dev/null || true
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Health Check End (Repaired) ===" >> "$HEALTH_CHECK_LOG"
    
    HEALTH_ISSUES="${issues[*]}"
    return 0
}

HEALTH_ISSUES=""
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
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failure notification suppressed (already notified)" >> "$GIT_LOG"
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

    if python3 "$SCRIPT_DIR/send_email.py" "$subject" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details" "$current_version" >> "$GIT_LOG" 2>&1; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Email sent: $subject" >> "$GIT_LOG"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Email failed: $subject" >> "$GIT_LOG"
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

    send_email "SD-UI 部署${status_text}" "$status" "$message" "$commit_title" "$commit_body" "$changed_files" "$extra_details" "$current_version"
}

ensure_scripts_executable() {
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
    chmod +x "$REPO_DIR"/scripts/*.sh 2>/dev/null || true
}

if [ -n "$HEALTH_ISSUES" ]; then
    notify "health_repaired" "系统自愈完成" "" "" "" "检测并修复的问题: $HEALTH_ISSUES"
fi

cd "$APP_DIR"

git fetch origin
REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "")
LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ -z "$LOCAL_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Not a git repository" >> "$GIT_LOG"
    notify "error" "Git 仓库错误" "" "" "" "无法获取本地 commit hash"
    exit 1
fi

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    exit 0
fi

if ! git rev-parse --verify --quiet HEAD@{u} 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected new branch, performing initial pull..." >> "$GIT_LOG"
    git pull origin main --ff-only 2>&1 | tee -a "$GIT_LOG" || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Initial pull failed, stashing local changes..." >> "$GIT_LOG"
        git stash 2>&1 | tee -a "$GIT_LOG" || true
        git pull origin main --ff-only 2>&1 | tee -a "$GIT_LOG" || true
        git stash pop 2>&1 | tee -a "$GIT_LOG" || true
    }
    ensure_scripts_executable
    echo "$REMOTE_HASH" > "$LATEST_HASH_FILE"
    save_version
    notify "success" "首次部署完成" "" "" "" "新分支初始化完成"
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected new commits, analyzing changes..." >> "$GIT_LOG"

LOCAL_CHANGES=$(git status --porcelain 2>/dev/null || echo "")
if [ -n "$LOCAL_CHANGES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local changes detected, analyzing..." >> "$GIT_LOG"

    HAS_STASH_CONTENT=false
    NEED_REBUILD=true

    if [ -n "$LOCAL_CHANGES" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stashing local changes..." >> "$GIT_LOG"
        git stash 2>&1 | tee -a "$GIT_LOG" || true
        HAS_STASH_CONTENT=true
    fi

    PULL_RESULT=$(git pull origin main --ff-only 2>&1 || echo "FAILED")
    echo "$PULL_RESULT" >> "$GIT_LOG"

    if echo "$PULL_RESULT" | grep -q "FAILED"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pull failed, restoring local changes..." >> "$GIT_LOG"
        if [ "$HAS_STASH_CONTENT" = true ]; then
            git stash pop 2>&1 | tee -a "$GIT_LOG" || true
        fi
        notify "error" "拉取失败" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "Git pull 失败，请检查网络或冲突"
        exit 1
    fi

    if [ "$HAS_STASH_CONTENT" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring local changes..." >> "$GIT_LOG"
        git stash pop 2>&1 | tee -a "$GIT_LOG" || true

        CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
        if [ -n "$CONFLICTS" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected conflicts: $CONFLICTS" >> "$GIT_LOG"
            git checkout --theirs . 2>/dev/null || true
            git add -A 2>/dev/null || true
        fi
    fi
else
    git pull origin main --ff-only 2>&1 | tee -a "$GIT_LOG" || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pull failed, attempting hard reset..." >> "$GIT_LOG"
        git reset --hard origin/main 2>&1 | tee -a "$GIT_LOG" || true
        notify "warning" "强制同步" "" "" "" "Git pull 失败，已执行硬重置"
    }
fi

ensure_scripts_executable
echo "$REMOTE_HASH" > "$LATEST_HASH_FILE"

CHANGED_FILES=$(git diff --name-only "$LOCAL_HASH" "$REMOTE_HASH" 2>/dev/null || echo "")
echo "Changed files: $CHANGED_FILES" >> "$GIT_LOG"

COMMIT_TITLE=$(git log --format="%s" "$LOCAL_HASH".."$REMOTE_HASH" 2>/dev/null | head -1 || echo "")
COMMIT_BODY=$(git log --format="%b" "$LOCAL_HASH".."$REMOTE_HASH" 2>/dev/null | head -1 || echo "")
COMMIT_COUNT=$(git rev-list --count "$LOCAL_HASH".."$REMOTE_HASH" 2>/dev/null || echo "1")

if [ -n "$COMMIT_TITLE" ]; then
    echo "Latest commit: $COMMIT_TITLE" >> "$GIT_LOG"
fi

SCRIPTS_CHANGED=false
FRONTEND_ONLY=false
BACKEND_CHANGED=false
DEPENDENCIES_CHANGED=false
PRISMA_SCHEMA_CHANGED=false
NEED_REBUILD=false

for file in $CHANGED_FILES; do
    case "$file" in
        scripts/*)
            SCRIPTS_CHANGED=true
            ;;
        ui/package.json|ui/package-lock.json|ui/yarn.lock|ui/pnpm-lock.yaml)
            DEPENDENCIES_CHANGED=true
            BACKEND_CHANGED=true
            ;;
        ui/prisma/schema.prisma)
            PRISMA_SCHEMA_CHANGED=true
            BACKEND_CHANGED=true
            ;;
        ui/src/app/api/*|ui/src/lib/*|ui/prisma/*|ui/src/services/*|ui/src/components/custom/*)
            BACKEND_CHANGED=true
            ;;
        ui/src/*|ui/*.css|ui/components.json|ui/public/*)
            FRONTEND_ONLY=true
            ;;
        *.md|README*|LICENSE|CONTRIBUTING*|.gitignore|.env*|*.yml|*.yaml)
            ;;
        *)
            ;;
    esac
done

if [ "$PRISMA_SCHEMA_CHANGED" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Prisma schema changed, will run migrations" >> "$GIT_LOG"
fi

if [ "$DEPENDENCIES_CHANGED" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dependencies changed, will run npm install" >> "$GIT_LOG"
fi

RELEVANT_CHANGE=false
if [ "$SCRIPTS_CHANGED" = true ] || [ "$BACKEND_CHANGED" = true ] || [ "$FRONTEND_ONLY" = true ]; then
    RELEVANT_CHANGE=true
fi

if [ "$RELEVANT_CHANGE" = false ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Only docs/config files changed, no action needed" >> "$GIT_LOG"
    exit 0
fi

DEPLOY_RESULT="success"
DEPLOY_MESSAGE=""
DEPLOY_DETAILS=""

if [ "$SCRIPTS_CHANGED" = true ] && [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Only scripts changed, no restart needed" >> "$GIT_LOG"
    DEPLOY_MESSAGE="脚本已更新"
    DEPLOY_DETAILS="部署脚本有更新，健康检查已执行"
    notify "success" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
elif [ "$BACKEND_CHANGED" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend/API changes detected, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
        DEPLOY_EXIT=$?
        if [ $DEPLOY_EXIT -ne 0 ]; then
            DEPLOY_RESULT="error"
            DEPLOY_MESSAGE="热部署失败"
            DEPLOY_DETAILS="hot-deploy.sh 退出码: $DEPLOY_EXIT"
        else
            DEPLOY_MESSAGE="热部署完成"
            DEPLOY_DETAILS="后端/API 变更已部署"
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="部署脚本错误"
        DEPLOY_DETAILS="hot-deploy.sh 不存在或不可执行"
        notify "error" "$DEPLOY_MESSAGE" "" "" "" "$DEPLOY_DETAILS"
        exit 1
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend only changes, rebuilding without restart..." >> "$GIT_LOG"

    npm install >> "$GIT_LOG" 2>&1
    npx prisma generate >> "$GIT_LOG" 2>&1
    npm run build >> "$GIT_LOG" 2>&1
    BUILD_EXIT=$?

    if [ $BUILD_EXIT -ne 0 ]; then
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="前端构建失败"
        DEPLOY_DETAILS="npm run build 退出码: $BUILD_EXIT"
        notify "error" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        exit 1
    fi

    if [ -f "$APP_DIR/scripts/sync-standalone-static.mjs" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Syncing static files..." >> "$GIT_LOG"
        node "$APP_DIR/scripts/sync-standalone-static.mjs" >> "$GIT_LOG" 2>&1 || true
    fi

    standalone_dir="$APP_DIR/.next/standalone"
    public_src="$APP_DIR/public"
    public_dest="$standalone_dir/public"

    if [ -d "$standalone_dir" ] && [ -d "$public_src" ]; then
        mkdir -p "$public_dest"
        cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Public files synced" >> "$GIT_LOG"
    fi

    systemctl --user restart sd-ui 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend rebuilt successfully" >> "$GIT_LOG"
    DEPLOY_MESSAGE="前端更新完成"
    DEPLOY_DETAILS="前端变更已构建并重启服务"
    notify "success" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generic update, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    fi
fi

save_version

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

record_stats "$DEPLOY_RESULT" "$DURATION" "$REMOTE_HASH" "$HEALTH_ISSUES"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete (duration: ${DURATION}s)" >> "$GIT_LOG"
