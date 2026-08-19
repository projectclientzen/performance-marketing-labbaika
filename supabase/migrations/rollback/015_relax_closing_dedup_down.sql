-- Rollback for 015_relax_closing_dedup.sql. Not auto-applied by Supabase CLI.

drop index if exists closings_whatsapp_departure_idx;

create unique index closings_dedup
  on closings (brand_id, whatsapp_e164, departure_id)
  where payment_status <> 'cancelled';
