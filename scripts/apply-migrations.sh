#!/usr/bin/env bash
# Menjalankan seluruh migrasi (dan opsional seed) ke satu database, berurutan,
# berhenti di kegagalan pertama.
#
# Ada karena dua migrasi pernah terpasang separuh: keduanya dijalankan dengan
# menempel isinya ke SQL Editor Supabase, satu statement gagal di tengah, dan
# tidak ada yang tahu. Statement sebelumnya sudah commit, sisanya terlewat,
# dan migrasinya terlihat berhasil. Perbaikannya makan waktu berjam-jam
# (10-AUDIT-FE-BE.md #22, #23).
#
#   ON_ERROR_STOP=1  -> berhenti di error pertama, bukan lanjut diam-diam
#   urutan berkas    -> ls terurut, 001 sampai 028
#
# Pemakaian:
#   export DATABASE_URL='postgresql://postgres:PASS@HOST:5432/postgres?sslmode=require'
#   ./scripts/apply-migrations.sh            # migrasi saja
#   ./scripts/apply-migrations.sh --with-seed # migrasi + seed data referensi
#
# Aman diulang: setiap migrasi memakai `if not exists` / `create or replace`,
# dan seed memakai `on conflict do nothing`.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL belum diisi." >&2
  echo "  export DATABASE_URL='postgresql://postgres:PASS@HOST:5432/postgres?sslmode=require'" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

echo "== Migrasi =="
for f in supabase/migrations/[0-9]*.sql; do
  printf '  %-46s ' "$(basename "$f")"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>/tmp/mig_err; then
    echo "ok"
  else
    echo "GAGAL"
    echo
    sed 's/^/    /' /tmp/mig_err >&2
    echo >&2
    echo "  Berhenti di $(basename "$f"). Berkas sebelumnya sudah terpasang." >&2
    echo "  Perbaiki penyebabnya lalu jalankan ulang skrip ini — migrasi yang" >&2
    echo "  sudah masuk tidak akan menimbulkan masalah saat diulang." >&2
    exit 1
  fi
done

if [[ "${1:-}" == "--with-seed" ]]; then
  echo
  echo "== Seed data referensi =="
  # Urutan penting: 00_brand membuat baris brands yang dirujuk seed lain.
  for f in supabase/seed/00_brand.sql \
           supabase/seed/lead_sources.sql \
           supabase/seed/insight_categories.sql \
           supabase/seed/regions.sql; do
    printf '  %-46s ' "$(basename "$f")"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
    echo "ok"
  done
fi

echo
echo "Selesai. Verifikasi cepat:"
psql "$DATABASE_URL" -q -c "
  select 'regions' t, count(*) n from regions
  union all select 'lead_sources', count(*) from lead_sources
  union all select 'insight_categories', count(*) from insight_categories
  union all select 'brands', count(*) from brands
  union all select 'app_users', count(*) from app_users
  order by 1;"
