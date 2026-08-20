-- Rollback untuk 023_drop_cost_revenue_only.sql. Tidak dijalankan otomatis.
--
-- PERINGATAN: rollback ini TIDAK LENGKAP dan tidak bisa dibuat lengkap.
-- Migrasi 023 membuang kolom dan tabel, jadi datanya hilang permanen:
--
--   - program_costs (seluruh baris HPP per program/keberangkatan/room type)
--   - closings.cost_at_transaction dan cost_source (HPP terkunci per transaksi)
--   - brand_settings.default_margin_pct
--
-- Struktur di bawah bisa dikembalikan; isinya tidak. cost_of_sales dan
-- gross_profit adalah kolom generated, jadi keduanya pulih sendiri begitu
-- cost_at_transaction ada lagi -- tapi nilainya NULL untuk setiap closing yang
-- sudah ada, sehingga gross_profit sama dengan total_value. Angka dashboard
-- akan salah sampai HPP diisi ulang manual.
--
-- Kalau perlu benar-benar kembali, pulihkan dari backup Supabase, jangan dari
-- berkas ini. Berkas ini hanya untuk mengembalikan bentuk schema di lingkungan
-- pengembangan yang datanya memang tidak berharga.

create type cost_source as enum ('actual', 'estimated', 'unknown');

alter table brand_settings add column if not exists default_margin_pct numeric;

alter table closings
  add column if not exists cost_at_transaction bigint,
  add column if not exists cost_source cost_source;

alter table closings
  add column if not exists cost_of_sales bigint generated always as
    (coalesce(cost_at_transaction, 0) * pax) stored,
  add column if not exists gross_profit bigint generated always as
    (total_value - coalesce(cost_at_transaction, 0) * pax) stored;

alter table closings add constraint closing_cost
  check (cost_at_transaction is null or cost_at_transaction >= 0);

create table if not exists program_costs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  program_id uuid not null references programs (id),
  departure_id uuid references program_departures (id),
  room_type room_type not null,
  cost_price bigint not null,
  effective_date date not null,
  end_date date,
  status text not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references app_users (id),

  constraint program_costs_price_nonneg check (cost_price >= 0),
  constraint program_costs_period check (end_date is null or end_date >= effective_date)
);

create index if not exists program_costs_program_id_idx on program_costs (program_id);
create index if not exists program_costs_departure_id_idx on program_costs (departure_id);

alter table program_costs add constraint program_costs_no_overlap
  exclude using gist (
    program_id with =,
    coalesce(departure_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    room_type with =,
    daterange(effective_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (status = 'active');

alter table program_costs enable row level security;
alter table program_costs force row level security;
create policy program_costs_owner_all on program_costs for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

grant select, insert, update, delete on program_costs to authenticated;

-- Trigger T-7, view v_closing_enriched, dan keempat fungsi analitik versi lama
-- TIDAK dibangun ulang di sini -- jalankan ulang 008, 016, 018, dan 019 secara
-- berurutan kalau benar-benar perlu bentuk lamanya.
