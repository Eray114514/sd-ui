#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_DIR/ui"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
GIT_LOG="$LOG_DIR/git-pull.log"
STATIC_SYNC="$SCRIPT_DIR/sync-standalone-static.mjs"

mkdir -p "$LOG_DIR"

LAST_STATUS_FILE="$LOG_DIR/.last_deploy_status"

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
    local details="${3:-}"

    if [ "$status" = "error" ] && ! should_send_failure_notification; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failure notification suppressed (already notified)" >> "$GIT_LOG"
        save_status "failed"
        return 0
    fi

    send_deployment_notification "$status" "$message" "$details"
    save_status "$status"
}

send_email() {
    local subject="$1"
    local html_body="$2"

    curl -s -X POST "https://api.resend.com/emails" \
        -H "Authorization: Bearer $RESEND_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"from\": \"$EMAIL_FROM\",
            \"to\": [\"$EMAIL_TO\"],
            \"subject\": \"$subject\",
            \"html\": \"$html_body\"
        }" >> "$GIT_LOG" 2>&1

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Email sent: $subject" >> "$GIT_LOG"
}

send_deployment_notification() {
    local status="$1"
    local message="$2"
    local details="${3:-}"

    local color="#4CAF50"
    local status_text="成功"

    if [ "$status" = "error" ]; then
        color="#f44336"
        status_text="失败"
    elif [ "$status" = "warning" ]; then
        color="#FF9800"
        status_text="警告"
    fi

    local html_body='<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background-color:'"$color"';padding:20px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">SD-UI 部署通知</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #eee;">
                                        <strong style="color:#666;font-size:14px;">状态</strong>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">
                                        <span style="display:inline-block;padding:4px 12px;border-radius:4px;background-color:'"$color"';color:#ffffff;font-size:14px;font-weight:500;">'"$status_text"'</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #eee;">
                                        <strong style="color:#666;font-size:14px;">时间</strong>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;color:#333;font-size:14px;">'"$(date '+%Y-%m-%d %H:%M:%S')"'</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0;border-bottom:1px solid #eee;">
                                        <strong style="color:#666;font-size:14px;">消息</strong>
                                    </td>
                                    <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;color:#333;font-size:14px;">'"$message"'</td>
                                </tr>
                                '"$(if [ -n "$details" ]; then echo '<tr><td style="padding:10px 0;" colspan="2"><pre style="background-color:#f9f9f9;padding:15px;border-radius:4px;font-size:12px;overflow-x:auto;color:#333;line-height:1.5;">'"$details"'</pre></td></tr>'; fi)"'
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#fafafa;padding:15px;text-align:center;border-top:1px solid #eee;">
                            <p style="margin:0;color:#999;font-size:12px;">此邮件由 SD-UI 自动部署系统发送</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'

    send_email "SD-UI 部署$status_text" "$html_body"
}

ensure_scripts_executable() {
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
    chmod +x "$REPO_DIR"/scripts/*.sh 2>/dev/null || true
}

cd "$APP_DIR"

LATEST_HASH_FILE="$LOG_DIR/.last_commit_hash"

git fetch origin
REMOTE_HASH=$(git rev-parse origin/main 2>/dev/null || echo "")
LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "")

if [ -z "$LOCAL_HASH" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Not a git repository" >> "$GIT_LOG"
    notify "error" "Git 仓库错误" "无法读取本地 Git 仓库"
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
    notify "success" "首次部署完成" "已拉取并构建最新版本"
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected new commits, analyzing changes..." >> "$GIT_LOG"

LOCAL_CHANGES=$(git status --porcelain 2>/dev/null || echo "")
if [ -n "$LOCAL_CHANGES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local changes detected, stashing..." >> "$GIT_LOG"
    git stash 2>&1 | tee -a "$GIT_LOG" || true
    PULL_RESULT=$(git pull origin main --ff-only 2>&1 || echo "FAILED")
    echo "$PULL_RESULT" >> "$GIT_LOG"

    if echo "$PULL_RESULT" | grep -q "FAILED"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pull failed, restoring local changes..." >> "$GIT_LOG"
        git stash pop 2>&1 | tee -a "$GIT_LOG" || true
        notify "error" "拉取失败" "无法从远程拉取更新，本地修改已恢复"
        exit 1
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring local changes..." >> "$GIT_LOG"
    git stash pop 2>&1 | tee -a "$GIT_LOG" || true
else
    git pull origin main --ff-only 2>&1 | tee -a "$GIT_LOG" || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pull failed, attempting hard reset..." >> "$GIT_LOG"
        git reset --hard origin/main 2>&1 | tee -a "$GIT_LOG" || true
        notify "warning" "强制同步" "使用硬重置同步到远程版本"
    }
fi

ensure_scripts_executable
echo "$REMOTE_HASH" > "$LATEST_HASH_FILE"

CHANGED_FILES=$(git diff --name-only "$LOCAL_HASH" "$REMOTE_HASH" 2>/dev/null || echo "")
echo "Changed files: $CHANGED_FILES" >> "$GIT_LOG"

SCRIPTS_CHANGED=false
FRONTEND_ONLY=false
BACKEND_CHANGED=false
DEPENDENCIES_CHANGED=false
PRISMA_SCHEMA_CHANGED=false

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

if [ "$SCRIPTS_CHANGED" = true ] && [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Only scripts changed, no restart needed" >> "$GIT_LOG"
    notify "success" "脚本已更新" "检测到脚本更新，已自动更新"
elif [ "$BACKEND_CHANGED" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend/API changes detected, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        notify "error" "部署脚本错误" "hot-deploy.sh 未找到或无执行权限"
        exit 1
    fi
elif [ "$FRONTEND_ONLY" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend only changes, rebuilding without restart..." >> "$GIT_LOG"

    npm install >> "$GIT_LOG" 2>&1
    npx prisma generate >> "$GIT_LOG" 2>&1
    npm run build >> "$GIT_LOG" 2>&1

    if [ -f "$APP_DIR/scripts/sync-standalone-static.mjs" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Syncing static files..." >> "$GIT_LOG"
        node "$APP_DIR/scripts/sync-standalone-static.mjs" >> "$GIT_LOG" 2>&1 || true
    fi

    local standalone_dir="$APP_DIR/.next/standalone"
    local public_src="$APP_DIR/public"
    local public_dest=""

    if [ -d "$standalone_dir" ] && [ -d "$public_src" ]; then
        if [ -f "$APP_DIR/package.json" ]; then
            local app_name=$(node -p "require('$APP_DIR/package.json').name" 2>/dev/null || echo "")
            if [ -n "$app_name" ] && [ -d "$standalone_dir/$app_name" ]; then
                public_dest="$standalone_dir/$app_name/public"
            fi
        fi

        if [ -z "$public_dest" ]; then
            if [ -d "$standalone_dir/ui" ]; then
                public_dest="$standalone_dir/ui/public"
            else
                public_dest="$standalone_dir/public"
            fi
        fi

        if [ -n "$public_dest" ]; then
            mkdir -p "$public_dest"
            cp -r "$public_src/"* "$public_dest/" 2>/dev/null || true
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Public files synced" >> "$GIT_LOG"
        fi
    fi

    systemctl --user restart sd-ui 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend rebuilt successfully (no restart - Next.js hot reload handles it)" >> "$GIT_LOG"
    notify "success" "前端更新完成" "前端代码已更新并构建，服务持续运行"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generic update, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete" >> "$GIT_LOG"
