#!/bin/bash
# =============================================================================
# Backup-Script fuer myProductivity SQLite-Datenbank
# Verwendung: ./scripts/backup.sh
# Cronjob:    0 2 * * * /path/to/my-productivity/scripts/backup.sh
# =============================================================================

set -euo pipefail

# Konfiguration
DB_PATH="$(dirname "$0")/../data/productivity.db"
BACKUP_DIR="${HOME}/Backups/my-productivity"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="${BACKUP_DIR}/productivity_${DATE}.db"

# Backup-Verzeichnis erstellen
mkdir -p "${BACKUP_DIR}"

# SQLite Backup (sicher auch bei laufender App dank WAL-Modus)
if [ -f "${DB_PATH}" ]; then
    sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"
    echo "Backup erstellt: ${BACKUP_FILE}"
else
    echo "Datenbank nicht gefunden: ${DB_PATH}"
    exit 1
fi

# Alte Backups aufräumen
find "${BACKUP_DIR}" -name "productivity_*.db" -mtime +${RETENTION_DAYS} -delete
echo "Alte Backups (>${RETENTION_DAYS} Tage) entfernt."
