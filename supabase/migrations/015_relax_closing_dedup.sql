-- 015_relax_closing_dedup.sql
-- CC-B18 fix: closings_dedup (migration 004) was a hard UNIQUE index, but
-- 02-PRD-v1.3.md §8.3 also requires "simpan tetap bisa dilakukan setelah
-- konfirmasi Owner (kasus PIC rombongan)" — a hard unique constraint has no
-- per-request bypass, so the two requirements are incompatible as originally
-- built. Relaxing to a plain (non-unique) index: duplicate detection and the
-- owner-confirm override both move to the API layer (see
-- app/api/closings/route.ts), which can apply the "unless force=true and
-- caller is owner" rule that a static DB constraint cannot express.

drop index if exists closings_dedup;

create index closings_whatsapp_departure_idx
  on closings (brand_id, whatsapp_e164, departure_id)
  where payment_status <> 'cancelled';
