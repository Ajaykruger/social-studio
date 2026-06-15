#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/social-studio}"
SERVICE_NAME="${SERVICE_NAME:-social-studio}"

cd "${APP_DIR}"

git pull --ff-only
npm ci
npm run build
sudo systemctl restart "${SERVICE_NAME}"

if "${APP_DIR}/deploy/healthcheck.sh"; then
  echo "Update finished and healthcheck passed."
else
  echo "Update finished, but the healthcheck failed. Check: journalctl -u ${SERVICE_NAME} -n 80 --no-pager"
  exit 1
fi
