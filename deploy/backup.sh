#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/social-studio}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/social-studio}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_ROOT}/social-studio-${STAMP}.tar.gz"

cd "${APP_DIR}"
mkdir -p "${BACKUP_ROOT}"
mkdir -p \
  social-studio/generated \
  social-studio/audit \
  social-studio/handoff \
  public/social-studio

tar -czf "${BACKUP_FILE}" \
  social-studio/generated \
  social-studio/audit \
  social-studio/handoff \
  public/social-studio

find "${BACKUP_ROOT}" -type f -name "social-studio-*.tar.gz" -mtime +14 -delete

echo "backup written: ${BACKUP_FILE}"
