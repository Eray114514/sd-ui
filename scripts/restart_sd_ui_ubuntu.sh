#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="sd-ui"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found. This script requires systemd user services."
  exit 1
fi

systemctl --user restart "$SERVICE_NAME"
systemctl --user status "$SERVICE_NAME" --no-pager
