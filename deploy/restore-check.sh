#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

DB_BACKUP="${1:-}"
UPLOADS_BACKUP="${2:-}"
MANIFEST="${3:-}"

fail() {
  printf '[restore-check] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "${DB_BACKUP}" && -f "${DB_BACKUP}" ]] \
  || fail "Usage: $0 <database.dump[.age|.gpg]> <uploads.tar.gz[.age|.gpg]> [manifest.sha256]"
[[ -n "${UPLOADS_BACKUP}" && -f "${UPLOADS_BACKUP}" ]] \
  || fail "Uploads backup not found: ${UPLOADS_BACKUP:-<empty>}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/carops-restore-check.XXXXXX")"
cleanup() {
  rm -rf -- "${TMP_DIR}"
}
trap cleanup EXIT

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

if [[ -n "${MANIFEST}" ]]; then
  [[ -f "${MANIFEST}" ]] || fail "Manifest not found: ${MANIFEST}"
  for source_file in "${DB_BACKUP}" "${UPLOADS_BACKUP}"; do
    expected="$(
      awk -v name="$(basename "${source_file}")" '$2 == name { print $1; exit }' "${MANIFEST}"
    )"
    [[ -n "${expected}" ]] || fail "No checksum for $(basename "${source_file}")"
    actual="$(hash_file "${source_file}")"
    [[ "${actual}" == "${expected}" ]] \
      || fail "Checksum mismatch for $(basename "${source_file}")"
  done
  printf '[restore-check] Checksums are valid.\n'
fi

decrypt_to() {
  local source_file="$1"
  local destination="$2"

  case "${source_file}" in
    *.age)
      command -v age >/dev/null 2>&1 || fail "age is required to inspect ${source_file}"
      [[ -n "${AGE_IDENTITY_FILE:-}" && -r "${AGE_IDENTITY_FILE}" ]] \
        || fail "Set AGE_IDENTITY_FILE to a readable age identity"
      age --decrypt --identity "${AGE_IDENTITY_FILE}" \
        --output "${destination}" "${source_file}"
      ;;
    *.gpg)
      command -v gpg >/dev/null 2>&1 || fail "gpg is required to inspect ${source_file}"
      gpg --batch --quiet --decrypt --output "${destination}" "${source_file}"
      ;;
    *)
      install -m 0600 "${source_file}" "${destination}"
      ;;
  esac
}

DB_PLAIN="${TMP_DIR}/database.dump"
UPLOADS_PLAIN="${TMP_DIR}/uploads.tar.gz"
decrypt_to "${DB_BACKUP}" "${DB_PLAIN}"
decrypt_to "${UPLOADS_BACKUP}" "${UPLOADS_PLAIN}"

if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "${DB_PLAIN}" >/dev/null
elif command -v docker >/dev/null 2>&1; then
  docker run --rm --network none -i postgres:16.9-alpine \
    pg_restore --list < "${DB_PLAIN}" >/dev/null
else
  fail "pg_restore or Docker is required for the database archive check"
fi
tar -tzf "${UPLOADS_PLAIN}" >/dev/null

printf '[restore-check] Database and uploads archives are structurally valid.\n'
printf '[restore-check] This check does not replace a scheduled restore into an isolated test stack.\n'
