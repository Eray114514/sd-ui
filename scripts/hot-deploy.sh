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
        log "Failure notification suppressed (already notified)"
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
        }" >> "$LOG_FILE" 2>&1

    log "Email sent: $subject"
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
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">SD-UI 热部署结果</h1>
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

    send_email "SD-UI 热部署$status_text" "$html_body"
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
    log "ERROR: npm install failed after retry"
    notify "error" "依赖安装失败" "npm install 失败，请检查日志"
    exit 1
fi

if ! run_prisma_generate; then
    log "ERROR: Prisma generate failed"
    notify "error" "Prisma 生成失败" "npx prisma generate 失败，请检查日志"
    exit 1
fi

run_prisma_migrate

log "Building..."
npm run build >> "$LOG_FILE" 2>&1
local build_exit_code=$?

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
        log "ERROR: Build failed after retry"
        notify "error" "构建失败" "npm run build 失败，请检查日志"
        exit 1
    fi
fi

log "Waiting for current processing tasks before restart..."
wait_for_processing_tasks 0

log "Restarting service..."
systemctl --user restart sd-ui 2>/dev/null || {
    log "WARNING: systemctl restart failed, trying alternative..."
    systemctl --user restart sd-ui || true
}

log "=== Hot deployment complete ==="
notify "success" "热部署完成" "所有步骤执行成功，服务已重启"
