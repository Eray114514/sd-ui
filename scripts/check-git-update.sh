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
    local commit_title="${3:-}"
    local commit_body="${4:-}"
    local changed_files="${5:-}"

    if [ "$status" = "error" ] && ! should_send_failure_notification; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failure notification suppressed (already notified)" >> "$GIT_LOG"
        save_status "failed"
        return 0
    fi

    send_deployment_notification "$status" "$message" "$commit_title" "$commit_body" "$changed_files"
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
    local commit_title="$3"
    local commit_body="$4"
    local changed_files="$5"

    local status_color="#10B981"
    local status_bg="#ECFDF5"
    local status_text="成功"
    local card_border="#374151"

    if [ "$status" = "error" ]; then
        status_color="#EF4444"
        status_bg="#FEF2F2"
        status_text="失败"
        card_border="#7F1D1D"
    elif [ "$status" = "warning" ]; then
        status_color="#F59E0B"
        status_bg="#FFFBEB"
        card_border="#92400E"
    fi

    local files_html=""
    if [ -n "$changed_files" ]; then
        local files_list=""
        for f in $changed_files; do
            local file_icon="📄"
            case "$f" in
                *.sh) file_icon="🔧" ;;
                *.tsx|*.ts) file_icon="⚛️" ;;
                *.json) file_icon="📋" ;;
                *.css|*.scss) file_icon="🎨" ;;
                *.prisma) file_icon="🗃️" ;;
                *.md) file_icon="📝" ;;
                ui/public/*) file_icon="🖼️" ;;
            esac
            files_list="${files_list}<div style='display:flex;align-items:center;padding:8px 12px;background:#1F2937;border-radius:6px;margin-bottom:6px;font-family:ui-monospace,monospace;font-size:13px;'><span style='margin-right:10px;'>${file_icon}</span><span style='color:#E5E7EB;word-break:break-all;'>${f}</span></div>"
        done
        files_html="<div style='margin-top:20px;'>
            <div style='font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;'>变更文件</div>
            ${files_list}
        </div>"
    fi

    local commit_html=""
    if [ -n "$commit_title" ]; then
        commit_html="<div style='margin-top:20px;'>
            <div style='font-size:13px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;'>Commit</div>
            <div style='background:#1F2937;border-radius:8px;padding:16px;border-left:3px solid ${status_color};'>
                <div style='font-size:15px;font-weight:600;color:#F3F4F6;margin-bottom:8px;'>${commit_title}</div>"
        if [ -n "$commit_body" ]; then
            commit_html="${commit_html}<div style='font-size:13px;color:#9CA3AF;line-height:1.6;white-space:pre-wrap;'>${commit_body}</div>"
        fi
        commit_html="${commit_html}</div></div>"
    fi

    local html_body='<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <style>
        body { margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    </style>
</head>
<body>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:30px 15px;">
        <tr>
            <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#1F2937;border-radius:16px;overflow:hidden;border:1px solid #374151;max-width:560px;">
                    <tr>
                        <td style="padding:28px 32px;border-bottom:1px solid #374151;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <div style="display:flex;align-items:center;">
                                            <div style="width:40px;height:40px;background:linear-gradient(135deg,${status_color} 0%,$(echo $status_color | sed 's/#/%23/')99 100%);border-radius:10px;margin-right:14px;display:flex;align-items:center;justify-content:center;">
                                                <span style="font-size:20px;">🚀</span>
                                            </div>
                                            <div>
                                                <div style="font-size:18px;font-weight:700;color:#F9FAFB;">SD-UI</div>
                                                <div style="font-size:12px;color:#6B7280;">自动部署系统</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td align="right">
                                        <span style="display:inline-block;padding:6px 14px;border-radius:20px;background:${status_bg};color:${status_color};font-size:13px;font-weight:600;">${status_text}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px;">
                            <div style="margin-bottom:20px;">
                                <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">消息</div>
                                <div style="font-size:16px;color:#F3F4F6;font-weight:500;">${message}</div>
                            </div>
                            <div style="margin-bottom:20px;">
                                <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">时间</div>
                                <div style="font-size:14px;color:#D1D5DB;">'"$(date '+%Y-%m-%d %H:%M:%S')"'</div>
                            </div>
                            '"$commit_html"'
                            '"$files_html"'
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px;background:#111827;border-top:1px solid #374151;">
                            <div style="text-align:center;">
                                <span style="font-size:12px;color:#4B5563;">此邮件由 SD-UI 自动部署系统发送</span>
                            </div>
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
    notify "error" "Git 仓库错误" "" "" ""
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
    notify "success" "首次部署完成" "" "" ""
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected new commits, analyzing changes..." >> "$GIT_LOG"

LOCAL_CHANGES=$(git status --porcelain 2>/dev/null || echo "")
if [ -n "$LOCAL_CHANGES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local changes detected, analyzing..." >> "$GIT_LOG"

    HAS_STASH_CONTENT=false

    if echo "$LOCAL_CHANGES" | grep -qE "package-lock\.json|yarn\.lock|pnpm-lock\.yaml"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Detected lock file changes, discarding them..." >> "$GIT_LOG"
        git checkout -- package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null || true
        LOCAL_CHANGES=$(git status --porcelain 2>/dev/null || echo "")
    fi

    if [ -n "$LOCAL_CHANGES" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stashing remaining local changes..." >> "$GIT_LOG"
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
        notify "error" "拉取失败" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES"
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

            if echo "$CONFLICTS" | grep -qE "package-lock\.json|yarn\.lock|pnpm-lock\.yaml"; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Discarding conflicted lock files..." >> "$GIT_LOG"
                git checkout origin/main -- package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null || true
            fi
        fi
    fi

    NEED_REBUILD=true
else
    git pull origin main --ff-only 2>&1 | tee -a "$GIT_LOG" || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pull failed, attempting hard reset..." >> "$GIT_LOG"
        git reset --hard origin/main 2>&1 | tee -a "$GIT_LOG" || true
        notify "warning" "强制同步" "" "" ""
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

if [ "$SCRIPTS_CHANGED" = true ] && [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Only scripts changed, no restart needed" >> "$GIT_LOG"
    notify "success" "脚本已更新" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES"
elif [ "$BACKEND_CHANGED" = true ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend/API changes detected, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hot-deploy.sh not found or not executable" >> "$GIT_LOG"
        notify "error" "部署脚本错误" "" "" ""
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
    notify "success" "前端更新完成" "$COMMIT_TITLE" "$COMMIT_BODY" "$CHANGED_FILES"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generic update, performing hot deployment..." >> "$GIT_LOG"
    if [ -x "$SCRIPT_DIR/hot-deploy.sh" ]; then
        "$SCRIPT_DIR/hot-deploy.sh"
    fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update complete" >> "$GIT_LOG"
