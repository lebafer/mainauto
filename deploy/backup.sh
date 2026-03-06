#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-mainauto}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"

mkdir -p "${BACKUP_DIR}"

COMPOSE_ARGS=(--env-file "${COMPOSE_ENV_FILE}")
if [[ -n "${COMPOSE_PROJECT_NAME}" ]]; then
  COMPOSE_ARGS+=(-p "${COMPOSE_PROJECT_NAME}")
fi

echo "[backup] Creating PostgreSQL dump..."
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "${BACKUP_DIR}/${BACKUP_PREFIX}_db_${TIMESTAMP}.sql"

echo "[backup] Archiving uploads..."
docker compose "${COMPOSE_ARGS[@]}" exec -T backend sh -lc 'tar -czf - -C /app/uploads .' \
  > "${BACKUP_DIR}/${BACKUP_PREFIX}_uploads_${TIMESTAMP}.tar.gz"

echo "[backup] Cleaning files older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "${BACKUP_PREFIX}_*" -mtime +"${RETENTION_DAYS}" -delete

echo "[backup] Done: ${TIMESTAMP}"
