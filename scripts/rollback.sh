#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

load_config
LOG_FILE="$LOG_DIR/rollback.log"

acquire_lock "rollback"
rotate_logs "$LOG_DIR"

START_TIME=$(date +%s)

log "$LOG_FILE" "=== Starting rollback ==="

load_env_file

if ! rollback_to_last_success; then
    log "$LOG_FILE" "Rollback failed"
    notify "$LOG_FILE" "error" "回滚失败" "" "" "" "无法回滚到上一个成功版本"
    exit 1
fi

cd "$APP_DIR"

log "$LOG_FILE" "Installing dependencies..."
if ! npm install >> "$LOG_FILE" 2>&1; then
    log "$LOG_FILE" "npm install failed"
    notify "$LOG_FILE" "error" "回滚失败" "" "" "" "npm install 失败

$(get_last_logs "$LOG_FILE" 100)"
    exit 1
fi

log "$LOG_FILE" "Generating Prisma client..."
if ! npx prisma generate >> "$LOG_FILE" 2>&1; then
    log "$LOG_FILE" "prisma generate failed"
    notify "$LOG_FILE" "error" "回滚失败" "" "" "" "prisma generate 失败

$(get_last_logs "$LOG_FILE" 100)"
    exit 1
fi

log "$LOG_FILE" "Building..."
if ! npm run build >> "$LOG_FILE" 2>&1; then
    log "$LOG_FILE" "Build failed"
    notify "$LOG_FILE" "error" "回滚失败" "" "" "" "构建失败

$(get_last_logs "$LOG_FILE" 100)"
    exit 1
fi

log "$LOG_FILE" "Restarting service..."
systemctl --user restart "$SERVICE_NAME" 2>/dev/null || {
    log "$LOG_FILE" "WARNING: systemctl restart failed, trying alternative..."
    systemctl --user restart "$SERVICE_NAME" || true
}

sleep 3

if check_service_health; then
    save_version
    log "$LOG_FILE" "Rollback successful"
    notify "$LOG_FILE" "success" "回滚成功" "" "" "" "已成功回滚到上一个成功版本"
else
    log "$LOG_FILE" "Rollback completed but health check failed"
    notify "$LOG_FILE" "warning" "回滚完成（健康检查未通过）" "" "" "" "服务已回滚但健康检查未通过，请手动检查"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "$LOG_FILE" "=== Rollback complete (duration: ${DURATION}s) ==="
