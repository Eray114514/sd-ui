#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="sd-ui"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found. This script requires systemd user services."
  exit 1
fi

if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "Service '$SERVICE_NAME' is running, restarting..."
  systemctl --user restart "$SERVICE_NAME"
else
  echo "Service '$SERVICE_NAME' is not running, starting..."
  systemctl --user start "$SERVICE_NAME"
fi

sleep 1
systemctl --user status "$SERVICE_NAME" --no-pager
