#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/ui"
SERVICE_NAME="sd-ui"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SYSTEMD_USER_DIR}/${SERVICE_NAME}.service"
LOG_DIR="${HOME}/.local/share/${SERVICE_NAME}/logs"
LOG_OUT="${LOG_DIR}/app.log"
LOG_ERR="${LOG_DIR}/error.log"

if [[ ! -d "$APP_DIR" ]]; then
  echo "App directory not found: $APP_DIR"
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found. This script requires systemd user services."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js not found. Please install Node.js first."
  exit 1
fi

mkdir -p "$SYSTEMD_USER_DIR"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=sd-ui Next.js service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:$APP_DIR/prisma/dev.db
ExecStart=/bin/bash -c 'if [ ! -d ".next" ]; then npx prisma generate >> $LOG_OUT 2>> $LOG_ERR && DATABASE_URL=file:$APP_DIR/prisma/dev.db npx prisma db push >> $LOG_OUT 2>> $LOG_ERR && npm run build >> $LOG_OUT 2>> $LOG_ERR; fi && mkdir -p $LOG_DIR && if [ -f .next/standalone/server.js ]; then PORT=3001 node .next/standalone/server.js -H 0.0.0.0 >> $LOG_OUT 2>> $LOG_ERR; elif [ -f .next/standalone/ui/server.js ]; then PORT=3001 node .next/standalone/ui/server.js -H 0.0.0.0 >> $LOG_OUT 2>> $LOG_ERR; else PORT=3001 npm run start -- -H 0.0.0.0; fi >> $LOG_OUT 2>> $LOG_ERR'
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
echo "Service written: $SERVICE_FILE"

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME" >/dev/null

echo "Autostart enabled. The service will start at next boot."
echo "Status: systemctl --user status $SERVICE_NAME"
echo "Logs:"
echo "  stdout: $LOG_OUT"
echo "  stderr: $LOG_ERR"

if command -v loginctl >/dev/null 2>&1; then
  if ! loginctl show-user "$USER" -p Linger | grep -q "Linger=yes"; then
    echo "Enabling user linger (requires sudo)..."
    sudo loginctl enable-linger "$USER"
  fi
fi
