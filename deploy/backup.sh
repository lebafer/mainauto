#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Creating PostgreSQL dump..."
docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "${BACKUP_DIR}/mainauto_db_${TIMESTAMP}.sql"

echo "[backup] Archiving uploads..."
docker compose exec -T backend sh -lc 'tar -czf - -C /app/uploads .' \
  > "${BACKUP_DIR}/mainauto_uploads_${TIMESTAMP}.tar.gz"

echo "[backup] Cleaning files older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name 'mainauto_*' -mtime +"${RETENTION_DAYS}" -delete

echo "[backup] Done: ${TIMESTAMP}"
