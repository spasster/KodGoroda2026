#!/usr/bin/env bash
# Отправляет анкеты живого демо в POST /api/ingest.
#   data/send_demo.sh data/sample/demo/intern_S-01_m6.json
#   API=http://localhost:8080 data/send_demo.sh data/sample/demo/*.json
set -euo pipefail

API="${API:-http://localhost:8000}"
API="${API%/}"

if [ $# -eq 0 ]; then
  echo "Использование: [API=http://адрес] $0 файл.json [файл.json ...]" >&2
  echo "Файлы демо:" >&2
  ls "$(dirname "$0")"/sample/demo/*.json >&2
  exit 1
fi

for f in "$@"; do
  echo "→ $f в $API/api/ingest" >&2
  curl -sS --fail-with-body -X POST "$API/api/ingest" \
    -H 'Content-Type: application/json' --data-binary "@$f" |
    if command -v jq >/dev/null; then jq .; else cat; echo; fi
done
