#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${HOME}/.local/share/sd-ui/logs"
LOG_FILE="$LOG_DIR/install_resend_sdk.log"

mkdir -p "$LOG_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Resend SDK installation..." >> "$LOG_FILE"

# 检查 Python 3 是否安装
if ! command -v python3 &> /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Python 3 not found, installing..." >> "$LOG_FILE"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update >> "$LOG_FILE" 2>&1
        sudo apt-get install -y python3 python3-pip >> "$LOG_FILE" 2>&1
    elif command -v yum &> /dev/null; then
        sudo yum install -y python3 python3-pip >> "$LOG_FILE" 2>&1
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error: Could not install Python 3" >> "$LOG_FILE"
        exit 1
    fi
fi

# 安装 Resend SDK
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing Resend Python SDK..." >> "$LOG_FILE"
python3 -m pip install resend >> "$LOG_FILE" 2>&1

# 验证安装
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying Resend SDK installation..." >> "$LOG_FILE"
python3 -c "import resend; print('Resend SDK version:', resend.__version__)" >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Resend SDK installation completed successfully" >> "$LOG_FILE"
echo "Resend SDK installation completed successfully"