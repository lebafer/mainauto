#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ENV_FILE="${1:-${ROOT_DIR}/deploy/.env.compose.example}"

cd "${ROOT_DIR}"

bash -n deploy/backup.sh deploy/restore-check.sh deploy/hardening-check.sh
docker compose --env-file "${ENV_FILE}" config --quiet

case "${ENV_FILE}" in
  *.example) ;;
  *)
    if grep -Eiq '(replace-me|replace-with|change-me|GENERATE_AND_REPLACE)' "${ENV_FILE}"; then
      printf '[hardening-check] Refusing placeholder secrets in %s\n' "${ENV_FILE}" >&2
      exit 1
    fi
    ;;
esac

grep -Fq 'bun install --frozen-lockfile' backend/Dockerfile
grep -Fq 'bun install --frozen-lockfile' webapp/Dockerfile
grep -Fq 'USER bun' backend/Dockerfile
grep -Fq 'USER nginx' webapp/Dockerfile
grep -Fq 'no-new-privileges:true' docker-compose.yml
grep -Fq 'read_only: true' docker-compose.yml
grep -Fq 'Content-Security-Policy' deploy/nginx.conf
grep -Fq 'X-Content-Type-Options "nosniff"' deploy/nginx.conf
grep -Fq 'set_real_ip_from 172.19.0.0/16' deploy/nginx.conf
grep -Fq 'real_ip_recursive on' deploy/nginx.conf

printf '[hardening-check] Shell syntax, Compose interpolation and baseline controls are valid.\n'
