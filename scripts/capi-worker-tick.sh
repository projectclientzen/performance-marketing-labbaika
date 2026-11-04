#!/usr/bin/env bash
# Satu "tick" scheduler untuk worker Purchase CAPI: POST /api/capi/worker.
#
# Butuh env (taruh di file mode 600, mis. /etc/labbaika/capi-worker.env, lalu
# muat lewat systemd EnvironmentFile= atau `set -a; . file; set +a` di cron):
#   CAPI_WORKER_URL     mis. https://staging.example/api/capi/worker
#   CAPI_WORKER_SECRET  sama dengan env app, minimal 32 karakter
#
# Secret dikirim lewat stdin ke curl (-H @-), jadi tidak muncul di argumen
# proses (`ps`) maupun di crontab. Respons worker hanya berisi hitungan
# (claimed/accepted/failed/held/completion_unknown) — aman dicatat ke log.
#
# Contoh cron tiap 5 menit:
#   */5 * * * * set -a; . /etc/labbaika/capi-worker.env; set +a; /opt/labbaika-reporting/scripts/capi-worker-tick.sh >> /var/log/capi-worker.log 2>&1
#
# Tick yang bertumpuk dicegah flock di host ini; antar-host, lease di database
# yang mencegah event diklaim dua kali.

set -euo pipefail

: "${CAPI_WORKER_URL:?CAPI_WORKER_URL belum diisi}"
: "${CAPI_WORKER_SECRET:?CAPI_WORKER_SECRET belum diisi}"

# flock ada di Linux (util-linux); di host tanpa flock, lease database tetap
# mencegah klaim ganda — tick bertumpuk hanya membuang satu request.
if command -v flock >/dev/null 2>&1; then
  exec 9>"${TMPDIR:-/tmp}/capi-worker-tick.lock"
  if ! flock -n 9; then
    echo "$(date -u +%FT%TZ) skip: tick sebelumnya masih berjalan"
    exit 0
  fi
fi

# 3 event × timeout 15 dtk per request + akses database; 90 dtk memberi ruang.
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
status="$(printf 'Authorization: Bearer %s\n' "$CAPI_WORKER_SECRET" |
  curl -sS --max-time 90 -X POST -H @- -o "$body_file" -w '%{http_code}' "$CAPI_WORKER_URL")" || status="000"

echo "$(date -u +%FT%TZ) http=$status $(head -c 300 "$body_file")"
[ "$status" = "200" ]
