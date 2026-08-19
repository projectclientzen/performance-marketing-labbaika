#!/usr/bin/env python3
"""Generate supabase/seed/regions.sql — 38 provinsi + 514 kabupaten/kota.

Sumber: https://github.com/anggitow/sql-indonesia-38-province
(daftar wilayah administratif Kemendagri, kode wilayah resmi, format BPS).
"""
import re

RAW_URL = (
    "https://raw.githubusercontent.com/anggitow/sql-indonesia-38-province/main/"
    "%5BPostgreSQL%5Dregions-updated-38province.sql"
)
RAW_PATH = "/tmp/regions_raw.sql"

import urllib.request

if __name__ == "__main__":
    urllib.request.urlretrieve(RAW_URL, RAW_PATH)
    text = open(RAW_PATH).read()
    rows = re.findall(r"\('([^']+)', '([^']+)'\)", text)

    clean_name = lambda n: re.sub(r"\s*\(.*?\)\s*", "", n).strip()

    out = []
    n_prov = n_city = 0
    for code, name in rows:
        c = code.replace(".", "")
        if len(c) == 2:
            out.append((c, "province", clean_name(name), None))
            n_prov += 1
        elif len(c) == 4:
            out.append((c, "city", clean_name(name), c[:2]))
            n_city += 1
        # length 6+ (kecamatan/desa) tidak dipakai

    lines = [
        "-- DS-01: Seed wilayah Indonesia (38 provinsi + seluruh kabupaten/kota)",
        "-- Sumber: daftar wilayah administratif Kemendagri (kode wilayah resmi).",
        "-- Struktur: (id, level, name, parent_id). Idempotent.",
        "INSERT INTO regions (id, level, name, parent_id) VALUES",
    ]
    values = []
    for rid, level, name, parent in out:
        parent_sql = "NULL" if parent is None else f"'{parent}'"
        values.append(f"  ('{rid}', '{level}', '{name.replace(chr(39), chr(39)*2)}', {parent_sql})")
    lines.append(",\n".join(values))
    lines.append("ON CONFLICT (id) DO NOTHING;")
    lines.append("")
    lines.append(f"-- Total: {n_prov} provinsi, {n_city} kabupaten/kota.")

    with open("supabase/seed/regions.sql", "w") as f:
        f.write("\n".join(lines))
    print(f"OK: {n_prov} provinces, {n_city} cities")
