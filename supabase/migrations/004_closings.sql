-- 004_closings.sql
-- CC-B05: closings
-- Ref: 04-BRIEF-BE.md §2.4, 02-PRD-v1.3.md §8.
--
-- cost_at_transaction / cost_of_sales / gross_profit are locked in by trigger
-- T-7 (CC-B08b) at insert time and never re-read from program_costs
-- afterwards. province_id/city_id reference regions.id, which is text
-- (Kemendagri code), not uuid. campaign_id has no FK yet: ad_campaigns
-- arrives in migration 005 (CC-B06).

create type cost_source as enum ('actual', 'estimated', 'unknown');

create table closings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  cs_id uuid not null references app_users (id),

  first_name text not null,
  last_name text,
  whatsapp_raw text not null,
  whatsapp_e164 text not null,
  email text,
  pdp_consent boolean not null default false,
  pdp_consent_at timestamptz,

  lead_date date not null,
  source_id uuid not null references lead_sources (id),
  campaign_id uuid,
  lead_report_id uuid references lead_reports (id),
  previous_stage lead_stage not null,

  closing_date date not null,
  program_id uuid not null references programs (id),
  departure_id uuid not null references program_departures (id),
  room_type room_type not null,
  pax int not null,

  price_at_transaction bigint not null,
  total_value bigint not null,
  is_price_override boolean not null default false,
  price_note text,

  cost_at_transaction bigint,
  cost_source cost_source,
  cost_of_sales bigint generated always as
    (coalesce(cost_at_transaction, 0) * pax) stored,
  gross_profit bigint generated always as
    (total_value - coalesce(cost_at_transaction, 0) * pax) stored,

  payment_status payment_status not null,
  paid_amount bigint not null default 0,
  cancelled_at timestamptz,
  cancel_reason text,

  province_id text references regions (id),
  city_id text references regions (id),
  address text,
  interval_days int generated always as (closing_date - lead_date) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_users (id),
  updated_by uuid references app_users (id),

  constraint closing_previous_stage_not_closing check (previous_stage <> 'closing'),
  constraint closing_after_lead check (closing_date >= lead_date),
  constraint closing_pax check (pax > 0),
  constraint closing_price check (price_at_transaction >= 0),
  constraint closing_total_value check (total_value >= 0),
  constraint closing_paid check (paid_amount >= 0 and paid_amount <= total_value),
  constraint closing_cost check (cost_at_transaction is null or cost_at_transaction >= 0),
  constraint closing_price_override_note check (
    is_price_override = false or price_note is not null
  ),
  constraint closing_pdp_consent_timestamp check (
    pdp_consent = false or pdp_consent_at is not null
  )
);

create unique index closings_dedup
  on closings (brand_id, whatsapp_e164, departure_id)
  where payment_status <> 'cancelled';

create index closings_brand_id_idx on closings (brand_id);
create index closings_cs_id_idx on closings (cs_id);
create index closings_lead_report_id_idx on closings (lead_report_id);
create index closings_closing_date_idx on closings (closing_date);
create index closings_lead_date_idx on closings (lead_date);
