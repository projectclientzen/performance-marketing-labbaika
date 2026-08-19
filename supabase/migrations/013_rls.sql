-- 013_rls.sql
-- CC-B13: RLS on every operational table
-- Ref: 04-BRIEF-BE.md §4.
--
-- owner: full CRUD on rows in their own brand.
-- cs: SELECT/INSERT/UPDATE only on rows in their own brand AND cs_id = auth.uid();
--     read-only on programs/departures/prices/sources/insight_categories/regions;
--     zero access to ad_performance, export_logs, audit_logs, period_locks,
--     program_costs, brand_settings, other app_users rows.
--     cs SELECT on `closings` is fully revoked — it reads through v_closings_cs
--     instead (created here as a plain view without cost/profit columns; the
--     real profitability-aware version lands in CC-B20).

-- SECURITY DEFINER is required here, not optional: app_users itself carries
-- RLS policies that call current_brand_id()/current_app_role(). If these ran
-- as invoker, their internal SELECT against app_users would re-trigger those
-- same policies, which call the function again -- infinite recursion
-- ("stack depth limit exceeded"). Running as definer (the migration owner,
-- exempt from RLS) makes the lookup a one-shot, non-recursive read.
create or replace function current_brand_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select brand_id from app_users where id = auth.uid()
$$;

create or replace function current_app_role() returns user_role
language sql stable security definer set search_path = public
as $$
  select role from app_users where id = auth.uid()
$$;

alter table brands enable row level security;
alter table brands force row level security;
create policy brands_owner_all on brands for all
  using (id = current_brand_id() and current_app_role() = 'owner')
  with check (id = current_brand_id() and current_app_role() = 'owner');
create policy brands_cs_select on brands for select
  using (id = current_brand_id());

alter table app_users enable row level security;
alter table app_users force row level security;
create policy app_users_owner_all on app_users for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy app_users_cs_self on app_users for select
  using (brand_id = current_brand_id() and id = auth.uid());

alter table regions enable row level security;
alter table regions force row level security;
create policy regions_all_read on regions for select using (true);

alter table lead_sources enable row level security;
alter table lead_sources force row level security;
create policy lead_sources_owner_all on lead_sources for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy lead_sources_cs_select on lead_sources for select
  using (brand_id = current_brand_id());

alter table insight_categories enable row level security;
alter table insight_categories force row level security;
create policy insight_categories_owner_all on insight_categories for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy insight_categories_cs_select on insight_categories for select
  using (brand_id = current_brand_id());

alter table programs enable row level security;
alter table programs force row level security;
create policy programs_owner_all on programs for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy programs_cs_select on programs for select
  using (brand_id = current_brand_id());

alter table program_departures enable row level security;
alter table program_departures force row level security;
create policy program_departures_owner_all on program_departures for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy program_departures_cs_select on program_departures for select
  using (brand_id = current_brand_id());

alter table program_prices enable row level security;
alter table program_prices force row level security;
create policy program_prices_owner_all on program_prices for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy program_prices_cs_select on program_prices for select
  using (brand_id = current_brand_id());

-- SENSITIVE. Owner-only, no cs policy at all -> cs gets zero rows.
alter table program_costs enable row level security;
alter table program_costs force row level security;
create policy program_costs_owner_all on program_costs for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

-- SENSITIVE. Owner-only.
alter table brand_settings enable row level security;
alter table brand_settings force row level security;
create policy brand_settings_owner_all on brand_settings for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table lead_reports enable row level security;
alter table lead_reports force row level security;
create policy lead_reports_owner_all on lead_reports for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy lead_reports_cs_own on lead_reports for select
  using (brand_id = current_brand_id() and cs_id = auth.uid());
create policy lead_reports_cs_insert on lead_reports for insert
  with check (brand_id = current_brand_id() and cs_id = auth.uid());
create policy lead_reports_cs_update on lead_reports for update
  using (brand_id = current_brand_id() and cs_id = auth.uid())
  with check (brand_id = current_brand_id() and cs_id = auth.uid());

alter table lead_report_insights enable row level security;
alter table lead_report_insights force row level security;
create policy lead_report_insights_owner_all on lead_report_insights for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy lead_report_insights_cs_own on lead_report_insights for select
  using (
    brand_id = current_brand_id()
    and exists (select 1 from lead_reports r where r.id = lead_report_id and r.cs_id = auth.uid())
  );
create policy lead_report_insights_cs_insert on lead_report_insights for insert
  with check (
    brand_id = current_brand_id()
    and exists (select 1 from lead_reports r where r.id = lead_report_id and r.cs_id = auth.uid())
  );
create policy lead_report_insights_cs_update on lead_report_insights for update
  using (
    brand_id = current_brand_id()
    and exists (select 1 from lead_reports r where r.id = lead_report_id and r.cs_id = auth.uid())
  )
  with check (
    brand_id = current_brand_id()
    and exists (select 1 from lead_reports r where r.id = lead_report_id and r.cs_id = auth.uid())
  );

-- closings: owner full access. cs has NO select/insert/update policy on the
-- base table at all -- write access for cs happens through the API using
-- the service role (server-side, after app-level auth checks), and cs reads
-- through v_closings_cs below. This is what lets the view omit cost columns
-- with a hard guarantee: there is no direct path to the base table for cs.
alter table closings enable row level security;
alter table closings force row level security;
create policy closings_owner_all on closings for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');
create policy closings_cs_insert on closings for insert
  with check (brand_id = current_brand_id() and cs_id = auth.uid());
create policy closings_cs_update on closings for update
  using (brand_id = current_brand_id() and cs_id = auth.uid())
  with check (brand_id = current_brand_id() and cs_id = auth.uid());
-- Deliberately no cs SELECT policy here: cs reads closings through
-- v_closings_cs below, which omits cost_at_transaction/cost_of_sales/gross_profit.

-- Intentionally the DEFAULT view security mode (owner-privilege, not
-- security_invoker): this view must read the closings base table on the
-- cs's behalf despite cs having no SELECT policy there at all. The WHERE
-- clause below is what actually scopes rows to the caller -- there is no
-- RLS safety net here, so it must stay correct.
create view v_closings_cs as
  select
    id, brand_id, cs_id, first_name, last_name, whatsapp_e164, email,
    pdp_consent, pdp_consent_at, lead_date, source_id, campaign_id,
    lead_report_id, previous_stage, closing_date, program_id, departure_id,
    room_type, pax, price_at_transaction, total_value, is_price_override,
    price_note, payment_status, paid_amount, cancelled_at, cancel_reason,
    province_id, city_id, address, interval_days, created_at, updated_at
  from closings
  where brand_id = current_brand_id() and cs_id = auth.uid();

-- SENSITIVE. Owner-only.
alter table ad_accounts enable row level security;
alter table ad_accounts force row level security;
create policy ad_accounts_owner_all on ad_accounts for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table ad_campaigns enable row level security;
alter table ad_campaigns force row level security;
create policy ad_campaigns_owner_all on ad_campaigns for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table ad_sets enable row level security;
alter table ad_sets force row level security;
create policy ad_sets_owner_all on ad_sets for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table ads enable row level security;
alter table ads force row level security;
create policy ads_owner_all on ads for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table ad_performance enable row level security;
alter table ad_performance force row level security;
create policy ad_performance_owner_all on ad_performance for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table period_locks enable row level security;
alter table period_locks force row level security;
create policy period_locks_owner_all on period_locks for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table export_logs enable row level security;
alter table export_logs force row level security;
create policy export_logs_owner_all on export_logs for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table sync_logs enable row level security;
alter table sync_logs force row level security;
create policy sync_logs_owner_all on sync_logs for all
  using (brand_id = current_brand_id() and current_app_role() = 'owner')
  with check (brand_id = current_brand_id() and current_app_role() = 'owner');

alter table audit_logs enable row level security;
alter table audit_logs force row level security;
create policy audit_logs_owner_select on audit_logs for select
  using (brand_id = current_brand_id() and current_app_role() = 'owner');
-- No insert/update/delete policy for anyone: audit_logs is written exclusively
-- by SECURITY DEFINER trigger functions (see below), which bypass RLS.

-- ---------------------------------------------------------------------------
-- Trigger functions run SECURITY INVOKER by default -- i.e. as whatever role
-- (owner or cs) fired the statement, and are therefore subject to RLS same as
-- any other query that role runs. That breaks two things once RLS is on:
--
-- 1. write_audit_log / block_locked_period INSERT into audit_logs, which has
--    no insert policy for anyone (see above) -- as invoker, the insert itself
--    would be rejected by RLS.
-- 2. lock_cost_at_closing SELECTs program_costs / brand_settings, which cs has
--    zero RLS access to. If a cs session inserts a closing directly, the
--    trigger would silently see no cost rows and fall back to
--    estimated/unknown even when real HPP data exists -- corrupting profit
--    numbers precisely for the role that must never see or influence them.
--
-- SECURITY DEFINER makes each function run with the privileges of its owner
-- (the migration role), bypassing RLS regardless of caller -- correct here
-- because these functions enforce data integrity, not row-level access
-- control; the RLS policies above are what actually gate direct access.
-- search_path is pinned to prevent search-path hijacking in DEFINER functions.

alter function write_audit_log() security definer set search_path = public;
alter function block_locked_period() security definer set search_path = public;
alter function lock_cost_at_closing() security definer set search_path = public;
alter function normalize_whatsapp() security definer set search_path = public;
alter function resolve_lead_report_link() security definer set search_path = public;
alter function validate_insight_total() security definer set search_path = public;
alter function revalidate_insight_totals() security definer set search_path = public;
alter function sync_closing_to_lead_report() security definer set search_path = public;
alter function apply_lead_report_stage_delta(uuid, lead_stage, int, int) security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Grants. New tables are not visible to Supabase's `authenticated` role by
-- default; RLS policies above are the real access gate, this just opens the
-- door for RLS to have something to filter.

grant usage on schema public to authenticated;

grant select, insert, update on
  brands, app_users, lead_sources, insight_categories, programs,
  program_departures, program_prices, lead_reports, lead_report_insights,
  closings
  to authenticated;

grant select, insert, update, delete on
  program_costs, brand_settings, ad_accounts, ad_campaigns, ad_sets, ads,
  ad_performance, period_locks, export_logs, sync_logs
  to authenticated;

grant select on regions, audit_logs, v_closings_cs to authenticated;
