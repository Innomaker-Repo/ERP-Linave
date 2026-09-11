#!/bin/bash
# This script is be ran through cron scheduler to backup media and database regularly
# sudo crontab -e  | 0 6 * * 6 /bin/bash /opt/ERP-Linave/backup.sh >> /var/log/erp-backup.log 2>&1
# Run on the host with Docker access and running database/backend containers.
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
KEEP_BACKUPS=2
TEMP_DIR=""

# Cleaning up in case of errors during backup
cleanup() {
    local status=$?
    trap - EXIT
    if [[ -n "$TEMP_DIR" ]]; then
        rm -rf -- "$TEMP_DIR"
    fi
    if (( status != 0 )); then
        echo "ERROR: Backup failed (exit ${status}); see preceding errors." >&2
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command in docker gzip tar flock mktemp find sort; do
    command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done
mkdir -p -- "$BACKUP_DIR"
chmod 700 -- "$BACKUP_DIR"
# Covers both cron and manual runs. Prevents 2 backups from being made alongside
exec 9>"${BACKUP_DIR}/.backup.lock"
if ! flock -n 9; then
    echo "Another backup is already running." >&2
    exit 1
fi
TEMP_DIR="$(mktemp -d "${BACKUP_DIR}/.incomplete.XXXXXXXX")"
echo "$(date -Is) Starting ERP backup"

# Read the existing container environment, without parsing/executing the host .env.
# InnoDB snapshot: avoid migrations while this runs.
docker exec erp_database sh -c '
    : "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is missing}"
    export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
    exec mysqldump --user=root --all-databases --single-transaction --quick --routines --events --triggers
' | gzip > "${TEMP_DIR}/database.sql.gz"
gzip -t "${TEMP_DIR}/database.sql.gz"

# Backend mounts the uploaded-document volume at /app/media.
# Database and media are sequential snapshots: schedule during a quiet period.
docker exec erp_backend tar -C /app/media -czf - . > "${TEMP_DIR}/media.tar.gz"
tar -tzf "${TEMP_DIR}/media.tar.gz" > /dev/null

# Publish only a complete set; random suffix prevents same-second collisions.
FINAL_DIR="${BACKUP_DIR}/erp_backup_$(date -u +%Y-%m-%d_%H%M%S_%N)_${TEMP_DIR##*.}"
mv -- "$TEMP_DIR" "$FINAL_DIR"
TEMP_DIR=""

# Preserve legacy .sql.gz files. Null delimiters handle spaces in installation paths. Only 2 sets at a given time can exist.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'erp_backup_*' -print0 | sort -zr > "${BACKUP_DIR}/.retention-list"
mapfile -d '' -t backups < "${BACKUP_DIR}/.retention-list"
for ((index=KEEP_BACKUPS; index<${#backups[@]}; index++)); do
    rm -rf -- "${backups[index]}"
done
rm -f -- "${BACKUP_DIR}/.retention-list"
echo "$(date -Is) Backup completed: ${FINAL_DIR}"
