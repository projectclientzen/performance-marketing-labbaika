-- 005_ads.sql
-- CC-B06: ads tables + retroactive FK for campaign_id on lead_reports/closings
-- Ref: 04-BRIEF-BE.md §2.5.

create table ad_accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  external_id text not null,
  name text not null,
  status text not null default 'active',
  unique (brand_id, external_id)
);

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  ad_account_id uuid not null references ad_accounts (id),
  external_id text not null,
  name text not null,
  objective text,
  status text not null default 'active',
  unique (brand_id, external_id)
);

create index ad_campaigns_ad_account_id_idx on ad_campaigns (ad_account_id);

create table ad_sets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  ad_campaign_id uuid not null references ad_campaigns (id),
  external_id text not null,
  name text not null,
  status text not null default 'active',
  unique (brand_id, external_id)
);

create index ad_sets_ad_campaign_id_idx on ad_sets (ad_campaign_id);

create table ads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  ad_set_id uuid not null references ad_sets (id),
  external_id text not null,
  name text not null,
  status text not null default 'active',
  unique (brand_id, external_id)
);

create index ads_ad_set_id_idx on ads (ad_set_id);

-- entity_id points at ad_accounts/ad_campaigns/ad_sets/ads depending on
-- `level`; no single FK target, so it stays a plain uuid (polymorphic ref).
create table ad_performance (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  level ad_level not null,
  entity_id uuid not null,
  date date not null,
  spend bigint not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  leads int not null default 0,
  created_at timestamptz not null default now(),

  constraint ad_performance_nonneg check (
    spend >= 0 and impressions >= 0 and reach >= 0 and clicks >= 0 and leads >= 0
  )
);

create unique index ad_performance_uniq
  on ad_performance (brand_id, level, entity_id, date);

create index ad_performance_date_idx on ad_performance (date);

-- Retroactive FK now that ad_campaigns exists (see migrations 003, 004).
alter table lead_reports
  add constraint lead_reports_campaign_id_fkey
  foreign key (campaign_id) references ad_campaigns (id);

alter table closings
  add constraint closings_campaign_id_fkey
  foreign key (campaign_id) references ad_campaigns (id);
