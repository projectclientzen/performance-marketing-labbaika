-- 003_lead_reports.sql
-- CC-B04: lead_reports + lead_report_insights
-- Ref: 04-BRIEF-BE.md §2.3, 02-PRD-v1.3.md §3.1, §5, §6.
--
-- `closing` is managed by trigger T-1 (CC-B09), never written directly by the
-- app. campaign_id intentionally has no FK yet: ad_campaigns is created in
-- migration 005 (CC-B06); the FK is added there once that table exists.

create table lead_reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  cs_id uuid not null references app_users (id),
  report_date date not null,
  source_id uuid not null references lead_sources (id),
  campaign_id uuid,
  campaign_key uuid generated always as (
    coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,

  total_lead int not null,
  cold int not null,
  consultation int not null,
  offering int not null,
  closing int not null default 0,

  idempotency_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_users (id),
  updated_by uuid references app_users (id),

  constraint lead_reports_sum_check
    check (cold + consultation + offering + closing = total_lead),
  constraint lead_reports_nonneg
    check (total_lead >= 0 and cold >= 0 and consultation >= 0
           and offering >= 0 and closing >= 0)
);

create unique index lead_reports_uniq
  on lead_reports (brand_id, cs_id, report_date, source_id, campaign_key);

create unique index lead_reports_idem
  on lead_reports (brand_id, idempotency_key) where idempotency_key is not null;

create index lead_reports_brand_date_idx on lead_reports (brand_id, report_date);
create index lead_reports_cs_id_idx on lead_reports (cs_id);

create table lead_report_insights (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  lead_report_id uuid not null references lead_reports (id) on delete cascade,
  stage lead_stage not null,
  category_id uuid not null references insight_categories (id),
  lead_count int not null default 0,
  note text,

  constraint lead_report_insights_nonneg check (lead_count >= 0)
);

create unique index lead_report_insights_uniq
  on lead_report_insights (lead_report_id, stage, category_id);

-- sum(lead_count) per (report, stage) <= stage count on lead_reports: cannot be
-- expressed as a plain CHECK (cross-row aggregate), enforced by trigger
-- T-3 `validate_insight_total` in CC-B10.
