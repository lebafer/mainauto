#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-carops}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
BACKUP_ENCRYPTION="${BACKUP_ENCRYPTION:-none}"
BACKUP_OFFSITE_HOOK="${BACKUP_OFFSITE_HOOK:-}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

fail() {
  printf '[backup] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ "${BACKUP_PREFIX}" =~ ^[A-Za-z0-9._-]+$ ]] \
  || fail "BACKUP_PREFIX may only contain letters, digits, dot, underscore and dash"
[[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] \
  || fail "RETENTION_DAYS must be a non-negative integer"
[[ -f "${COMPOSE_ENV_FILE}" ]] \
  || fail "Compose env file not found: ${COMPOSE_ENV_FILE}"
if [[ -n "${BACKUP_OFFSITE_HOOK}" && "${BACKUP_OFFSITE_HOOK}" != /* ]]; then
  fail "BACKUP_OFFSITE_HOOK must be an absolute path"
fi
if [[ "${BACKUP_ENCRYPTION}" == "none" ]]; then
  printf '[backup] WARNING: backups are not application-level encrypted.\n' >&2
fi

install -d -m 0700 "${BACKUP_DIR}"
BACKUP_DIR_ABS="$(cd "${BACKUP_DIR}" && pwd -P)"
[[ -n "${BACKUP_DIR_ABS}" && "${BACKUP_DIR_ABS}" != "/" ]] \
  || fail "Refusing unsafe BACKUP_DIR: ${BACKUP_DIR_ABS:-<empty>}"

TMP_DIR="$(mktemp -d "${BACKUP_DIR_ABS}/.${BACKUP_PREFIX}.tmp.XXXXXX")"
cleanup() {
  rm -rf -- "${TMP_DIR}"
}
trap cleanup EXIT

COMPOSE_ARGS=(--env-file "${COMPOSE_ENV_FILE}")
if [[ -n "${COMPOSE_PROJECT_NAME}" ]]; then
  COMPOSE_ARGS+=(-p "${COMPOSE_PROJECT_NAME}")
fi

docker compose "${COMPOSE_ARGS[@]}" config --quiet

DB_PLAIN="${TMP_DIR}/${BACKUP_PREFIX}_db_${TIMESTAMP}.dump"
UPLOADS_PLAIN="${TMP_DIR}/${BACKUP_PREFIX}_uploads_${TIMESTAMP}.tar.gz"

printf '[backup] Creating PostgreSQL custom-format dump...\n'
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres sh -ec \
  'exec pg_dump --format=custom --compress=6 --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "${DB_PLAIN}"
[[ -s "${DB_PLAIN}" ]] || fail "PostgreSQL dump is empty"

printf '[backup] Archiving uploads...\n'
docker compose "${COMPOSE_ARGS[@]}" exec -T backend \
  tar -czf - -C /app/uploads . > "${UPLOADS_PLAIN}"
[[ -s "${UPLOADS_PLAIN}" ]] || fail "Uploads archive is empty"

encrypt_and_publish() {
  local source_file="$1"
  local source_name
  local encrypted_file
  local destination
  source_name="$(basename "${source_file}")"

  case "${BACKUP_ENCRYPTION}" in
    none)
      destination="${BACKUP_DIR_ABS}/${source_name}"
      install -m 0600 "${source_file}" "${destination}"
      ;;
    age)
      command -v age >/dev/null 2>&1 || fail "age is required for BACKUP_ENCRYPTION=age"
      [[ -n "${AGE_RECIPIENT:-}" ]] || fail "AGE_RECIPIENT is required"
      encrypted_file="${TMP_DIR}/${source_name}.age"
      age --encrypt --recipient "${AGE_RECIPIENT}" --output "${encrypted_file}" "${source_file}"
      destination="${BACKUP_DIR_ABS}/${source_name}.age"
      install -m 0600 "${encrypted_file}" "${destination}"
      ;;
    gpg)
      command -v gpg >/dev/null 2>&1 || fail "gpg is required for BACKUP_ENCRYPTION=gpg"
      [[ -n "${GPG_RECIPIENT:-}" ]] || fail "GPG_RECIPIENT is required"
      encrypted_file="${TMP_DIR}/${source_name}.gpg"
      gpg --batch --yes --trust-model always --encrypt \
        --recipient "${GPG_RECIPIENT}" --output "${encrypted_file}" "${source_file}"
      destination="${BACKUP_DIR_ABS}/${source_name}.gpg"
      install -m 0600 "${encrypted_file}" "${destination}"
      ;;
    *)
      fail "BACKUP_ENCRYPTION must be one of: none, age, gpg"
      ;;
  esac

  FINAL_FILES+=("${destination}")
}

FINAL_FILES=()
encrypt_and_publish "${DB_PLAIN}"
encrypt_and_publish "${UPLOADS_PLAIN}"

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

MANIFEST_TMP="${TMP_DIR}/${BACKUP_PREFIX}_manifest_${TIMESTAMP}.sha256"
for backup_file in "${FINAL_FILES[@]}"; do
  printf '%s  %s\n' "$(hash_file "${backup_file}")" "$(basename "${backup_file}")"
done > "${MANIFEST_TMP}"

MANIFEST="${BACKUP_DIR_ABS}/$(basename "${MANIFEST_TMP}")"
install -m 0600 "${MANIFEST_TMP}" "${MANIFEST}"
FINAL_FILES+=("${MANIFEST}")

if [[ -n "${BACKUP_OFFSITE_HOOK}" ]]; then
  [[ -x "${BACKUP_OFFSITE_HOOK}" ]] \
    || fail "BACKUP_OFFSITE_HOOK is not an executable file: ${BACKUP_OFFSITE_HOOK}"
  printf '[backup] Running offsite hook...\n'
  "${BACKUP_OFFSITE_HOOK}" "${FINAL_FILES[@]}"
fi

RETENTION_MINUTES=$((RETENTION_DAYS * 1440))
printf '[backup] Removing completed backup files older than %s days...\n' "${RETENTION_DAYS}"
find "${BACKUP_DIR_ABS}" -maxdepth 1 -type f \
  -name "${BACKUP_PREFIX}_*" -mmin +"${RETENTION_MINUTES}" -delete

printf '[backup] Completed %s\n' "${TIMESTAMP}"
printf '  %s\n' "${FINAL_FILES[@]}"
