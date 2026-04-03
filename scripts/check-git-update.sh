#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

load_config
GIT_LOG="$LOG_DIR/git-pull.log"
HEALTH_CHECK_LOG="$LOG_DIR/health-check.log"

acquire_lock "check-git"
rotate_logs "$LOG_DIR"

START_TIME=$(date +%s)

load_env_file

if ! validate_env; then
    notify "$GIT_LOG" "error" "环境变量缺失" "缺少必要的环境变量，请检查 .env 文件" "" "" ""
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
        local db_path="${DATABASE_URL#file:}"
        if [ ! -f "$db_path" ] && [ ! -f "$APP_DIR/$db_path" ]; then
            issues+=("database missing")
            echo "[Health] database missing, need db push" >> "$HEALTH_CHECK_LOG"
        elif [ -d "$APP_DIR/prisma/migrations" ] && [ -n "$(ls -A "$APP_DIR/prisma/migrations" 2>/dev/null)" ]; then
            if ! npx prisma migrate status >> "$HEALTH_CHECK_LOG" 2>&1; then
                issues+=("prisma migration pending")
                echo "[Health] prisma migration pending or failed" >> "$HEALTH_CHECK_LOG"
            fi
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

    if [ "$need_db_push" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Running prisma db push..." >> "$GIT_LOG"
        cd "$APP_DIR"
        npx prisma db push >> "$HEALTH_CHECK_LOG" 2>&1 || true
        cd "$REPO_DIR"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Database push complete" >> "$GIT_LOG"
    fi

    if [ "$need_migrate" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Running prisma migrate deploy..." >> "$GIT_LOG"
        cd "$APP_DIR"
        npx prisma migrate deploy >> "$HEALTH_CHECK_LOG" 2>&1 || true
        cd "$REPO_DIR"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Migration complete" >> "$GIT_LOG"
    fi

    if [ "$need_rebuild" = true ] || [ "$need_migrate" = true ] || [ "$need_db_push" = true ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health repair: Restarting service..." >> "$GIT_LOG"
        systemctl --user restart "$SERVICE_NAME" 2>/dev/null || true
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Health Check End (Repaired) ===" >> "$HEALTH_CHECK_LOG"

    HEALTH_ISSUES="${issues[*]}"
    return 0
}

HEALTH_ISSUES=""
health_check

if [ -n "$HEALTH_ISSUES" ]; then
    notify "$GIT_LOG" "health_repaired" "系统自愈完成" "" "" "" "检测并修复的问题: $HEALTH_ISSUES"
fi

cd "$APP_DIR"

if [ -z "${SSH_AUTH_SOCK:-}" ]; then
    if [ -n "${XDG_RUNTIME_DIR:-}" ] && [ -S "$XDG_RUNTIME_DIR/ssh-agent.socket" ]; then
        export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"
    else
        for sock in $(find /tmp -type s -name "agent.*" -user "$USER" 2>/dev/null); do
            export SSH_AUTH_SOCK="$sock"
            break
        done
    fi
fi

git fetch origin >> "$GIT_LOG" 2>&1 || {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: git fetch failed (SSH auth issue in cron?)" >> "$GIT_LOG"
}

REMOTE_HASH=$(git rev-parse "origin/$GIT_BRANCH" 2>/dev/null || echo "")
LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ -z "$LOCAL_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Not a git repository" >> "$GIT_LOG"
    notify "$GIT_LOG" "error" "Git 仓库错误" "" "" "" "无法获取本地 commit hash"
    exit 1
fi

CURRENT_VERSION=$(get_current_version)
if [ "$LOCAL_HASH" != "$CURRENT_VERSION" ] && [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected manual pull, updating version..." >> "$GIT_LOG"
    save_version "$GIT_LOG"
fi

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    exit 0
fi

if ! git rev-parse --verify --quiet HEAD@{u} 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected new branch, performing initial pull..." >> "$GIT_LOG"
    git pull "origin/$GIT_BRANCH" --ff-only 2>&1 | tee -a "$GIT_LOG" || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Initial pull failed, stashing local changes..." >> "$GIT_LOG"
        git stash 2>&1 | tee -a "$GIT_LOG" || true
        git pull "origin/$GIT_BRANCH" --ff-only 2>&1 | tee -a "$GIT_LOG" || true
        git stash pop 2>&1 | tee -a "$GIT_LOG" || true
    }
    ensure_scripts_executable
    save_version "$GIT_LOG"
    notify "$GIT_LOG" "success" "首次部署完成" "" "" "" "新分支初始化完成"
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected new commits, analyzing changes..." >> "$GIT_LOG"

LOCAL_CHANGES=$(git status --porcelain 2>/dev/null || echo "")
if [ -n "$LOCAL_CHANGES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local changes detected, analyzing..." >> "$GIT_LOG"

    HAS_STASH_CONTENT=false
    NEED_REBUILD=true

    if [ -n "$LOCAL_CHANGES" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stashing local changes (including untracked)..." >> "$GIT_LOG"
        git stash -u 2>&1 | tee -a "$GIT_LOG" || true
        HAS_STASH_CONTENT=true
    fi

    PULL_RESULT=$(git merge "origin/$GIT_BRANCH" --ff-only 2>&1 || echo "FAILED")
    echo "$PULL_RESULT" >> "$GIT_LOG"

    if echo "$PULL_RESULT" | grep -q "FAILED"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Merge failed, attempting hard reset and clean to resolve conflict..." >> "$GIT_LOG"
        git reset --hard "origin/$GIT_BRANCH" 2>&1 | tee -a "$GIT_LOG" || true
        git clean -fd 2>&1 | tee -a "$GIT_LOG" || true
        
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ensuring scripts remain executable after hard reset..." >> "$GIT_LOG"
        chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
        
        if [ "$HAS_STASH_CONTENT" = true ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring local changes after hard reset..." >> "$GIT_LOG"
            git stash pop 2>&1 | tee -a "$GIT_LOG" || true
            
            CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")
            if [ -n "$CONFLICTS" ]; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected conflicts: $CONFLICTS" >> "$GIT_LOG"
                git checkout --theirs . 2>/dev/null || true
                git add -A 2>/dev/null || true
            fi
        fi
        
        COMMIT_TITLE=$(git log -1 --format="%s" "origin/$GIT_BRANCH" 2>/dev/null || echo "Unknown Commit")
        notify "$GIT_LOG" "warning" "强制同步" "${COMMIT_TITLE:-}" "" "" "Git pull / merge 失败，已执行硬重置并尝试恢复本地修改"
    else
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
    fi
else
    git merge "origin/$GIT_BRANCH" --ff-only 2>&1 | tee -a "$GIT_LOG" || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Merge failed, attempting hard reset and clean..." >> "$GIT_LOG"
        git reset --hard "origin/$GIT_BRANCH" 2>&1 | tee -a "$GIT_LOG" || true
        git clean -fd 2>&1 | tee -a "$GIT_LOG" || true
        
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ensuring scripts remain executable after hard reset..." >> "$GIT_LOG"
        chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
        
        COMMIT_TITLE=$(git log -1 --format="%s" "origin/$GIT_BRANCH" 2>/dev/null || echo "Unknown Commit")
        notify "$GIT_LOG" "warning" "强制同步" "${COMMIT_TITLE:-}" "" "" "Git pull / merge 失败，已执行硬重置和清理"
    }
fi

ensure_scripts_executable

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
    notify "$GIT_LOG" "success" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
elif [ "$BACKEND_CHANGED" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend/API changes detected, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
        DEPLOY_EXIT=$?
        if [ $DEPLOY_EXIT -ne 0 ]; then
            DEPLOY_RESULT="error"
            DEPLOY_MESSAGE="热部署失败"
            DEPLOY_DETAILS="hot-deploy.sh 退出码: $DEPLOY_EXIT

$(get_last_logs "$LOG_DIR/hot-deploy.log" 100)"
            notify "$GIT_LOG" "error" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        else
            DEPLOY_MESSAGE="热部署完成"
            DEPLOY_DETAILS="后端/API 变更已部署"
            notify "$GIT_LOG" "success" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="部署脚本错误"
        DEPLOY_DETAILS="hot-deploy.sh 不存在或不可执行"
        notify "$GIT_LOG" "error" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        exit 1
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend only changes, rebuilding and restarting..." >> "$GIT_LOG"

    if check_dependencies_changed "$LOCAL_HASH" "$REMOTE_HASH"; then
        npm install >> "$GIT_LOG" 2>&1
    fi
    npx prisma generate >> "$GIT_LOG" 2>&1
    npm run build >> "$GIT_LOG" 2>&1
    BUILD_EXIT=$?

    if [ $BUILD_EXIT -ne 0 ]; then
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="前端构建失败"
        DEPLOY_DETAILS="npm run build 退出码: $BUILD_EXIT

$(get_last_logs "$GIT_LOG" 100)"
        notify "$GIT_LOG" "error" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
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

    wait_for_processing_tasks
    systemctl --user restart "$SERVICE_NAME" 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend rebuilt and restarted successfully" >> "$GIT_LOG"
    DEPLOY_MESSAGE="前端更新完成"
    DEPLOY_DETAILS="前端变更已构建并重启服务"
    notify "$GIT_LOG" "success" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generic update, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
        DEPLOY_EXIT=$?
        if [ $DEPLOY_EXIT -ne 0 ]; then
            DEPLOY_RESULT="error"
            DEPLOY_MESSAGE="热部署失败"
            DEPLOY_DETAILS="hot-deploy.sh 退出码: $DEPLOY_EXIT

$(get_last_logs "$LOG_DIR/hot-deploy.log" 100)"
            notify "$GIT_LOG" "error" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        else
            DEPLOY_MESSAGE="热部署完成"
            DEPLOY_DETAILS="通用变更已部署"
            notify "$GIT_LOG" "success" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        DEPLOY_RESULT="error"
        DEPLOY_MESSAGE="部署脚本错误"
        DEPLOY_DETAILS="hot-deploy.sh 不存在或不可执行"
        notify "$GIT_LOG" "error" "$DEPLOY_MESSAGE" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES" "$DEPLOY_DETAILS"
        exit 1
    fi
fi

save_version "$GIT_LOG"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

record_stats "$DEPLOY_RESULT" "$DURATION" "$REMOTE_HASH" "$HEALTH_ISSUES"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete (duration: ${DURATION}s)" >> "$GIT_LOG"
