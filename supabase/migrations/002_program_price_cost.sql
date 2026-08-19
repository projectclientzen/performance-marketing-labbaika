-- 002_program_price_cost.sql
-- CC-B03: programs, departures, prices, costs, brand_settings
-- Ref: 04-BRIEF-BE.md §2.2. Fixes P1-06 (program vs departure), P1-07 (room_type
-- pricing), P2-14 (overlapping price periods).
--
-- program_costs and brand_settings hold HPP/margin: the most sensitive data in
-- the system (02-PRD-v1.3.md §4). No grant to the cs role is issued anywhere in
-- this file, and none should be added later — access is owner-only via RLS (B13).

create table programs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  name text not null,
  destination text not null,
  duration_days int not null check (duration_days > 0),
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index programs_brand_id_idx on programs (brand_id);

create table program_departures (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  program_id uuid not null references programs (id),
  departure_date date not null,
  return_date date,
  quota int,
  status text not null default 'active',
  created_at timestamptz not null default now(),

  constraint program_departures_dates check (return_date is null or return_date >= departure_date)
);

create index program_departures_program_id_idx on program_departures (program_id);

create table program_prices (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  program_id uuid not null references programs (id),
  departure_id uuid references program_departures (id),
  room_type room_type not null,
  price bigint not null,
  effective_date date not null,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references app_users (id),

  constraint program_prices_price_nonneg check (price >= 0),
  constraint program_prices_period check (end_date is null or end_date >= effective_date)
);

create index program_prices_program_id_idx on program_prices (program_id);
create index program_prices_departure_id_idx on program_prices (departure_id);

-- Prevents two active prices for the same (program, departure, room_type)
-- from covering overlapping date ranges. NULL departure_id (program-level,
-- no per-departure pricing) is coalesced to a sentinel so exclusion still
-- applies — Postgres would otherwise treat every NULL as distinct.
alter table program_prices add constraint program_prices_no_overlap
  exclude using gist (
    program_id with =,
    coalesce(departure_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    room_type with =,
    daterange(effective_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (status = 'active');

-- SENSITIVE TABLE. RLS owner-only (enforced in CC-B13). Kept separate from
-- program_prices, which the cs role can SELECT — see 04-BRIEF-BE.md §2.2.
create table program_costs (
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

create index program_costs_program_id_idx on program_costs (program_id);
create index program_costs_departure_id_idx on program_costs (departure_id);

alter table program_costs add constraint program_costs_no_overlap
  exclude using gist (
    program_id with =,
    coalesce(departure_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    room_type with =,
    daterange(effective_date, coalesce(end_date, 'infinity'::date), '[]') with &&
  ) where (status = 'active');

-- SENSITIVE TABLE. RLS owner-only (enforced in CC-B13).
create table brand_settings (
  brand_id uuid primary key references brands (id),
  default_margin_pct numeric,
  auto_lock_days int not null default 45,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users (id)
);
