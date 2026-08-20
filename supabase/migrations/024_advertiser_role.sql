-- 024_advertiser_role.sql
-- Keputusan produk (Maszen, 20 Agustus 2026): tambah role `advertiser`, dengan
-- sudut pandang yang sama persis dengan `owner`.
--
--   "role advertiser ini pov nya sama kaya role owner, jadi cukup 1 dashboard
--    utama aja"
--
-- Jadi ini bukan tingkat akses ketiga dengan aturan sendiri. Advertiser dan
-- owner melihat dashboard yang sama; yang membedakan cuma sebutan jabatannya.
-- Yang berdiri sendiri tetap `cs`: satu CS tidak boleh melihat pekerjaan CS
-- lain (dijaga migrasi 023).
--
-- Cara yang TIDAK diambil: membuat current_app_role() mengembalikan 'owner'
-- untuk advertiser. Itu memang membuat 21 policy di bawah tidak perlu disentuh
-- sama sekali, tapi policy yang tertulis `= 'owner'` lalu diam-diam bernilai
-- benar untuk advertiser adalah jebakan buat pembaca berikutnya, dan bikin
-- audit_logs mencatat peran yang salah. Lebih baik verbose tapi jujur.
--
-- Sebagai gantinya: satu fungsi bantu `current_has_owner_access()`, lalu ke-21
-- policy dibuat ulang memakainya. Perbandingannya lewat ::text, bukan literal
-- enum, karena Postgres melarang memakai nilai enum yang baru ditambahkan di
-- transaksi yang sama -- migrasi ini akan gagal kalau ditulis
-- `current_app_role() in ('owner','advertiser')`.

alter type user_role add value if not exists 'advertiser';

create or replace function current_has_owner_access() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_app_role()::text in ('owner', 'advertiser')
$$;

comment on function current_has_owner_access() is
  'True untuk owner dan advertiser. Dipakai seluruh policy dan guard yang dulu menulis current_app_role() = ''owner''. Bukan pengganti current_app_role(), yang tetap mengembalikan peran sebenarnya untuk audit dan manajemen user.';

-- ---------------------------------------------------------------------------
-- Policy: brands memakai kolom `id`, sisanya `brand_id`.
-- ---------------------------------------------------------------------------

drop policy if exists brands_owner_all on brands;
create policy brands_owner_all on brands for all
  using (id = current_brand_id() and current_has_owner_access())
  with check (id = current_brand_id() and current_has_owner_access());

drop policy if exists app_users_owner_all on app_users;
create policy app_users_owner_all on app_users for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists lead_sources_owner_all on lead_sources;
create policy lead_sources_owner_all on lead_sources for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists insight_categories_owner_all on insight_categories;
create policy insight_categories_owner_all on insight_categories for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists programs_owner_all on programs;
create policy programs_owner_all on programs for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists program_departures_owner_all on program_departures;
create policy program_departures_owner_all on program_departures for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists program_prices_owner_all on program_prices;
create policy program_prices_owner_all on program_prices for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists brand_settings_owner_all on brand_settings;
create policy brand_settings_owner_all on brand_settings for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists lead_reports_owner_all on lead_reports;
create policy lead_reports_owner_all on lead_reports for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists lead_report_insights_owner_all on lead_report_insights;
create policy lead_report_insights_owner_all on lead_report_insights for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists closings_owner_all on closings;
create policy closings_owner_all on closings for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists ad_accounts_owner_all on ad_accounts;
create policy ad_accounts_owner_all on ad_accounts for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists ad_campaigns_owner_all on ad_campaigns;
create policy ad_campaigns_owner_all on ad_campaigns for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists ad_sets_owner_all on ad_sets;
create policy ad_sets_owner_all on ad_sets for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists ads_owner_all on ads;
create policy ads_owner_all on ads for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists ad_performance_owner_all on ad_performance;
create policy ad_performance_owner_all on ad_performance for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists period_locks_owner_all on period_locks;
create policy period_locks_owner_all on period_locks for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists export_logs_owner_all on export_logs;
create policy export_logs_owner_all on export_logs for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists sync_logs_owner_all on sync_logs;
create policy sync_logs_owner_all on sync_logs for all
  using (brand_id = current_brand_id() and current_has_owner_access())
  with check (brand_id = current_brand_id() and current_has_owner_access());

drop policy if exists audit_logs_owner_select on audit_logs;
create policy audit_logs_owner_select on audit_logs for select
  using (brand_id = current_brand_id() and current_has_owner_access());

-- program_costs sengaja tidak ada di daftar ini: tabelnya dibuang migrasi 023.
-- ---------------------------------------------------------------------------
-- Guard fungsi. Keenam fungsi ini menolak non-owner secara eksplisit; kalimat
-- penolakannya diganti supaya advertiser ikut lolos. Badan query-nya tidak
-- disentuh sama sekali -- hanya baris IF di kepalanya.
-- ---------------------------------------------------------------------------

create or replace function get_dashboard_overview(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_attribution text default 'cash',
  p_source_id uuid default null,
  p_campaign_id uuid default null
) returns table (
  spend bigint, meta_leads bigint, cpl_meta numeric,
  total_lead bigint, cold bigint, consultation bigint, offering bigint, closing bigint,
  reached_consultation bigint, reached_offering bigint, reached_closing bigint,
  gross_booking_value bigint, collected_revenue bigint, cancellation_rate numeric,
  net_revenue bigint, roi numeric, roas numeric, cpp numeric, breakeven_cpp numeric,
  ad_cost_ratio numeric, median_closing_interval_days numeric, campaign_attribution_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;
  -- Omset dan spend se-brand adalah angka perusahaan. 02-PRD-v1.3.md §4: cs
  -- tidak melihatnya. Sebelum migrasi ini guard-nya hanya ada di route.
  if not current_has_owner_access() then
    raise exception 'akses ditolak: hanya owner/advertiser' using errcode = '42501';
  end if;

  return query
  select imp.* from _get_dashboard_overview_impl(
    p_brand_id, p_from, p_to, p_attribution, p_source_id, p_campaign_id
  ) as imp;
end;
$$;

create or replace function get_campaign_quality(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_attribution text default 'cohort'
) returns table (
  campaign_id uuid, campaign_name text, spend bigint, meta_leads bigint, cpl_meta numeric,
  total_lead bigint, reached_consultation bigint, reached_offering bigint, closing bigint,
  closing_rate numeric, gross_booking_value bigint, cpp numeric, breakeven_cpp numeric,
  roi numeric, roas numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;
  if not current_has_owner_access() then
    raise exception 'akses ditolak: hanya owner/advertiser' using errcode = '42501';
  end if;

  return query
  select imp.* from _get_campaign_quality_impl(p_brand_id, p_from, p_to, p_attribution) as imp;
end;
$$;

create or replace function get_lead_insight_summary(
  p_brand_id uuid,
  p_from date,
  p_to date
) returns table (
  category_id uuid,
  category_name text,
  lead_count bigint,
  pct_of_filled numeric,
  pct_of_total_lead numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;
  if not current_has_owner_access() then
    raise exception 'akses ditolak: hanya owner/advertiser' using errcode = '42501';
  end if;

  return query
  select imp.* from _get_lead_insight_summary_impl(p_brand_id, p_from, p_to) as imp;
end;
$$;

create or replace function get_export_operational(
  p_brand_id uuid,
  p_from date default null,
  p_to date default null,
  p_cs uuid default null,
  p_program uuid default null,
  p_source uuid default null,
  p_status payment_status default null,
  p_offset int default 0,
  p_limit int default 1000
) returns table (
  lead_date date,
  name text,
  whatsapp text,
  city text,
  source_id uuid,
  stage text,
  closing_date date,
  program text,
  room_type room_type,
  pax int,
  total_value bigint,
  paid_amount bigint,
  status payment_status
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;
  if not current_has_owner_access() then
    raise exception 'akses ditolak: hanya owner/advertiser' using errcode = '42501';
  end if;

  return query
  select
    c.lead_date,
    trim(concat_ws(' ', c.first_name, c.last_name)),
    c.whatsapp_e164,
    r_city.name,
    c.source_id,
    'closing'::text,
    c.closing_date,
    p.name,
    c.room_type,
    c.pax,
    c.total_value,
    c.paid_amount,
    c.payment_status
  from closings c
  join programs p on p.id = c.program_id
  left join regions r_city on r_city.id = c.city_id
  where c.brand_id = p_brand_id
    and (p_from is null or c.closing_date >= p_from)
    and (p_to is null or c.closing_date <= p_to)
    and (p_cs is null or c.cs_id = p_cs)
    and (p_program is null or c.program_id = p_program)
    and (p_source is null or c.source_id = p_source)
    and (p_status is null or c.payment_status = p_status)
  order by c.closing_date desc, c.id
  offset p_offset limit p_limit;
end;
$$;

create or replace function get_export_meta_ltv(
  p_brand_id uuid,
  p_from date default null,
  p_to date default null,
  p_offset int default 0,
  p_limit int default 1000
) returns table (
  phone text,
  email text,
  name text,
  city text,
  state text,
  total_value bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;
  if not current_has_owner_access() then
    raise exception 'akses ditolak: hanya owner/advertiser' using errcode = '42501';
  end if;

  return query
  select
    c.whatsapp_e164,
    c.email,
    trim(concat_ws(' ', c.first_name, c.last_name)),
    r_city.name,
    r_prov.name,
    c.total_value
  from closings c
  left join regions r_city on r_city.id = c.city_id
  left join regions r_prov on r_prov.id = c.province_id
  where c.brand_id = p_brand_id
    and c.pdp_consent = true
    and c.payment_status <> 'cancelled'
    and (p_from is null or c.closing_date >= p_from)
    and (p_to is null or c.closing_date <= p_to)
  order by c.closing_date desc, c.id
  offset p_offset limit p_limit;
end;
$$;

create or replace function get_cs_performance(
  p_brand_id uuid,
  p_from date,
  p_to date
) returns table (
  cs_id uuid,
  cs_name text,
  total_lead bigint,
  cold bigint,
  consultation bigint,
  offering bigint,
  closing bigint,
  gross_booking_value bigint,
  avg_closing_interval numeric,
  median_closing_interval numeric,
  cancellation_rate numeric,
  report_days bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;  -- true untuk owner DAN advertiser
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;

  v_is_owner := current_has_owner_access();

  return query
  select imp.*
  from _get_cs_performance_impl(p_brand_id, p_from, p_to) as imp
  where v_is_owner or imp.cs_id = auth.uid();
end;
$$;

revoke execute on function current_has_owner_access() from public, anon;
grant execute on function current_has_owner_access() to authenticated;
