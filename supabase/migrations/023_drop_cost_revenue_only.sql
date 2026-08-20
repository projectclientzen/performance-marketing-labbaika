-- 023_drop_cost_revenue_only.sql
-- Keputusan produk (Maszen, 20 Agustus 2026): HPP dan gross profit keluar dari
-- lingkup sistem ini seluruhnya.
--
--   "harusnya gak ada gross, fokus ke omset karena aku gak handle hpp ...
--    aplikasi ini cuma buat ngukur efektivitas iklan dan cs serta melihat roi
--    atau roas yang dihasilkan dari iklan ... cuma ada revenue aja"
--
-- Pemiliknya advertiser, bukan bagian keuangan. Aplikasi ini alat koordinasi
-- dengan CS dan pelaporan efektivitas iklan ke owner. Harga program iya, HPP
-- program tidak -- struktur biaya bukan ranahnya, dan datanya tidak pernah
-- akan terisi. 02-PRD-v1.3.md dan 04-BRIEF-BE.md membawa HPP dari draft awal;
-- prototype FE ikut menampilkan kolom Gross Profit karena diturunkan dari
-- dokumen itu, bukan karena diminta.
--
-- Menyimpan kolom biaya yang selamanya NULL bukan pilihan netral: ROI,
-- margin, dan break-even CPP semuanya dihitung darinya, jadi dashboard akan
-- menampilkan angka yang salah secara diam-diam (gross_profit = revenue - 0
-- = revenue, margin selalu 100%). Lebih baik dibuang.
--
-- Metrik diformulasikan ulang di atas omset:
--
--   roi           = (omset - spend) / spend      (dulu: dari gross profit)
--   roas          = omset / spend                (baru -- diminta eksplisit)
--   breakeven_cpp = omset / jumlah closing       (dulu: gross profit / closing)
--   ad_cost_ratio = spend / omset                (tidak berubah, sudah omset)
--   cpp           = spend / jumlah closing       (tidak berubah)
--
-- `breakeven_cpp` namanya dipertahankan karena artinya justru jadi lebih
-- lurus: tanpa HPP, titik impas biaya per closing memang sama dengan omset
-- per closing. `cppStatus()` di FE tidak perlu berubah.
--
-- Dihapus: gross_profit, margin_pct, net_contribution, cost_coverage_rate.
-- Nama kolom lain sengaja dipertahankan persis supaya FE tidak diam-diam
-- kehilangan kolom -- pelajaran dari export kemarin, di mana nama field yang
-- meleset menghasilkan CSV berisi kolom kosong tanpa error apa pun.
--
-- Sekalian ditutup di sini (satu migrasi, karena menyentuh fungsi yang sama):
-- keempat fungsi analitik hanya menjaga brand, tidak menjaga role. Grant
-- EXECUTE-nya ke `authenticated`, jadi CS yang sudah login bisa memanggilnya
-- langsung dari browser dengan anon key dan menarik omset serta spend
-- se-brand, melewati pengecekan role yang selama ini hanya hidup di
-- TypeScript. get_cs_performance bahkan mengembalikan baris SETIAP cs --
-- penyaringannya ada di route, bukan di database. Itu bertentangan langsung
-- dengan 02-PRD-v1.3.md §4 dan dengan permintaan eksplisit pemilik: antar-CS
-- tidak boleh saling melihat.

-- ---------------------------------------------------------------------------
-- Langkah 1: buang objek yang bergantung pada kolom biaya.
-- Urutan wajib -- view dan fungsi dulu, baru kolomnya.
-- ---------------------------------------------------------------------------

drop function if exists get_dashboard_overview(uuid,date,date,text,uuid,uuid);
drop function if exists get_campaign_quality(uuid,date,date,text);
drop function if exists get_cs_performance(uuid,date,date);
-- get_lead_insight_summary tidak menyentuh kolom biaya, tapi wrapper-nya dari
-- 019 hanya menjaga brand tanpa menjaga role -- dibuat ulang di bawah dengan
-- guard owner. `_get_lead_insight_summary_impl` dari 018/019 tetap dipakai
-- apa adanya, jadi jangan ikut di-drop.
drop function if exists get_lead_insight_summary(uuid,date,date);
drop function if exists _get_dashboard_overview_impl(uuid,date,date,text,uuid,uuid);
drop function if exists _get_campaign_quality_impl(uuid,date,date,text);
drop function if exists _get_cs_performance_impl(uuid,date,date);

drop view if exists v_closing_enriched;

-- T-7 mengunci HPP saat insert closing (migrasi 008). Tanpa program_costs
-- trigger ini tidak punya sumber data dan tidak punya tujuan.
drop trigger if exists trg_lock_cost_at_transaction on closings;
drop function if exists lock_cost_at_transaction();

-- ---------------------------------------------------------------------------
-- Langkah 2: buang kolom dan tabel biaya.
-- ---------------------------------------------------------------------------

alter table closings
  drop column if exists gross_profit,          -- generated
  drop column if exists cost_of_sales,         -- generated
  drop column if exists cost_at_transaction,
  drop column if exists cost_source;

alter table closings drop constraint if exists closing_cost;

drop table if exists program_costs;
drop type if exists cost_source;

-- default_margin_pct hanya dipakai untuk menurunkan target margin dari HPP.
-- auto_lock_days tidak ada hubungannya dengan biaya dan tetap tinggal.
alter table brand_settings drop column if exists default_margin_pct;

-- ---------------------------------------------------------------------------
-- Langkah 3: bangun ulang view fakta closing, tanpa kolom biaya.
-- ---------------------------------------------------------------------------

create view v_closing_enriched as
select
  c.*,
  (c.payment_status = 'cancelled') as is_cancelled,
  case when c.payment_status <> 'cancelled' then c.total_value else 0 end as revenue_gross,
  p.name as program_name,
  d.departure_date,
  r_prov.name as province_name,
  r_city.name as city_name,
  u.full_name as cs_name
from closings c
join programs p on p.id = c.program_id
join program_departures d on d.id = c.departure_id
left join regions r_prov on r_prov.id = c.province_id
left join regions r_city on r_city.id = c.city_id
join app_users u on u.id = c.cs_id;

-- Tetap tertutup dari anon/authenticated seperti yang ditetapkan migrasi 019 --
-- view ini masih membawa PII jamaah (nama, WhatsApp, email), meskipun kolom
-- biayanya sudah tidak ada. Akses hanya lewat fungsi ber-guard di bawah.
revoke all on v_closing_enriched from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Langkah 4: impl analitik, diformulasikan ulang di atas omset.
-- Bentuknya mengikuti migrasi 019: `language sql` impl tanpa grant, dibungkus
-- wrapper plpgsql security definer yang memegang guard. Alasannya tetap sama --
-- nama kolom RETURNS TABLE jadi variabel PL/pgSQL dan bentrok dengan kolom
-- sumber bernama sama kalau query besarnya ditulis langsung sebagai plpgsql.
-- ---------------------------------------------------------------------------

create function _get_dashboard_overview_impl(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_attribution text default 'cash',
  p_source_id uuid default null,
  p_campaign_id uuid default null
) returns table (
  spend bigint,
  meta_leads bigint,
  cpl_meta numeric,
  total_lead bigint,
  cold bigint,
  consultation bigint,
  offering bigint,
  closing bigint,
  reached_consultation bigint,
  reached_offering bigint,
  reached_closing bigint,
  gross_booking_value bigint,
  collected_revenue bigint,
  cancellation_rate numeric,
  net_revenue bigint,
  roi numeric,
  roas numeric,
  cpp numeric,
  breakeven_cpp numeric,
  ad_cost_ratio numeric,
  median_closing_interval_days numeric,
  campaign_attribution_rate numeric
)
language sql
stable
as $$
  with lead_agg as (
    select
      coalesce(sum(total_lead), 0)::bigint as total_lead,
      coalesce(sum(cold), 0)::bigint as cold,
      coalesce(sum(consultation), 0)::bigint as consultation,
      coalesce(sum(offering), 0)::bigint as offering,
      coalesce(sum(closing), 0)::bigint as closing,
      coalesce(sum(consultation + offering + closing), 0)::bigint as reached_consultation,
      coalesce(sum(offering + closing), 0)::bigint as reached_offering,
      coalesce(sum(closing), 0)::bigint as reached_closing,
      coalesce(sum(total_lead) filter (where campaign_id is not null), 0)::numeric
        / nullif(sum(total_lead), 0) as campaign_attribution_rate
    from lead_reports
    where brand_id = p_brand_id
      and report_date between p_from and p_to
      and (p_source_id is null or source_id = p_source_id)
      and (p_campaign_id is null or campaign_id = p_campaign_id)
  ),
  closing_agg as (
    select
      coalesce(sum(revenue_gross), 0)::bigint as gross_booking_value,
      coalesce(sum(paid_amount) filter (where payment_status <> 'cancelled'), 0)::bigint as collected_revenue,
      count(*) filter (where payment_status <> 'cancelled') as closing_count,
      count(*) filter (where payment_status = 'cancelled') as cancelled_count,
      count(*) as total_count,
      percentile_cont(0.5) within group (order by interval_days)
        filter (where payment_status <> 'cancelled') as median_interval
    from v_closing_enriched
    where brand_id = p_brand_id
      and (case when p_attribution = 'cohort' then lead_date else closing_date end) between p_from and p_to
      and (p_source_id is null or source_id = p_source_id)
      and (p_campaign_id is null or campaign_id = p_campaign_id)
  ),
  ads_agg as (
    select
      coalesce(sum(spend), 0)::bigint as spend,
      coalesce(sum(leads), 0)::bigint as leads
    from ad_performance
    where brand_id = p_brand_id
      and date between p_from and p_to
      and level = 'campaign'
      and (p_campaign_id is null or entity_id = p_campaign_id)
  )
  select
    ads_agg.spend,
    ads_agg.leads as meta_leads,
    ads_agg.spend::numeric / nullif(ads_agg.leads, 0) as cpl_meta,
    lead_agg.total_lead, lead_agg.cold, lead_agg.consultation, lead_agg.offering, lead_agg.closing,
    lead_agg.reached_consultation, lead_agg.reached_offering, lead_agg.reached_closing,
    closing_agg.gross_booking_value,
    closing_agg.collected_revenue,
    closing_agg.cancelled_count::numeric / nullif(closing_agg.total_count, 0) as cancellation_rate,
    closing_agg.gross_booking_value - ads_agg.spend as net_revenue,
    (closing_agg.gross_booking_value - ads_agg.spend)::numeric / nullif(ads_agg.spend, 0) as roi,
    closing_agg.gross_booking_value::numeric / nullif(ads_agg.spend, 0) as roas,
    ads_agg.spend::numeric / nullif(closing_agg.closing_count, 0) as cpp,
    closing_agg.gross_booking_value::numeric / nullif(closing_agg.closing_count, 0) as breakeven_cpp,
    ads_agg.spend::numeric / nullif(closing_agg.gross_booking_value, 0) as ad_cost_ratio,
    closing_agg.median_interval as median_closing_interval_days,
    lead_agg.campaign_attribution_rate
  from lead_agg, closing_agg, ads_agg
$$;

create function _get_campaign_quality_impl(
  p_brand_id uuid, p_from date, p_to date, p_attribution text default 'cohort'
) returns table (
  campaign_id uuid, campaign_name text, spend bigint, meta_leads bigint, cpl_meta numeric,
  total_lead bigint, reached_consultation bigint, reached_offering bigint, closing bigint,
  closing_rate numeric, gross_booking_value bigint, cpp numeric, breakeven_cpp numeric,
  roi numeric, roas numeric
)
language sql
stable
as $$
  select
    c.id as campaign_id, c.name as campaign_name,
    o.spend, o.meta_leads, o.cpl_meta, o.total_lead,
    o.reached_consultation, o.reached_offering, o.closing,
    o.closing::numeric / nullif(o.total_lead, 0) as closing_rate,
    o.gross_booking_value, o.cpp, o.breakeven_cpp, o.roi, o.roas
  from ad_campaigns c
  cross join lateral _get_dashboard_overview_impl(p_brand_id, p_from, p_to, p_attribution, null, c.id) o
  where c.brand_id = p_brand_id
  order by o.roi desc nulls last;
$$;

create function _get_cs_performance_impl(
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
language sql
stable
as $$
  select
    u.id as cs_id,
    u.full_name as cs_name,
    coalesce(lr.total_lead, 0) as total_lead,
    coalesce(lr.cold, 0) as cold,
    coalesce(lr.consultation, 0) as consultation,
    coalesce(lr.offering, 0) as offering,
    coalesce(lr.closing, 0) as closing,
    coalesce(ce.gross_booking_value, 0) as gross_booking_value,
    ce.avg_interval as avg_closing_interval,
    ce.median_interval as median_closing_interval,
    ce.cancellation_rate,
    coalesce(lr.report_days, 0) as report_days
  from app_users u
  left join (
    select
      cs_id,
      sum(total_lead) as total_lead, sum(cold) as cold, sum(consultation) as consultation,
      sum(offering) as offering, sum(closing) as closing,
      count(distinct report_date) as report_days
    from lead_reports
    where brand_id = p_brand_id and report_date between p_from and p_to
    group by cs_id
  ) lr on lr.cs_id = u.id
  left join (
    select
      cs_id,
      sum(revenue_gross) as gross_booking_value,
      avg(interval_days) filter (where payment_status <> 'cancelled') as avg_interval,
      percentile_cont(0.5) within group (order by interval_days)
        filter (where payment_status <> 'cancelled') as median_interval,
      count(*) filter (where payment_status = 'cancelled')::numeric / nullif(count(*), 0) as cancellation_rate
    from v_closing_enriched
    where brand_id = p_brand_id and closing_date between p_from and p_to
    group by cs_id
  ) ce on ce.cs_id = u.id
  where u.brand_id = p_brand_id and u.role = 'cs'
  order by coalesce(ce.gross_booking_value, 0) desc;
$$;

-- ---------------------------------------------------------------------------
-- Langkah 5: wrapper publik. Guard brand DAN role.
-- ---------------------------------------------------------------------------

create function get_dashboard_overview(
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
  if current_app_role() <> 'owner' then
    raise exception 'akses ditolak: hanya owner' using errcode = '42501';
  end if;

  return query
  select imp.* from _get_dashboard_overview_impl(
    p_brand_id, p_from, p_to, p_attribution, p_source_id, p_campaign_id
  ) as imp;
end;
$$;

create function get_campaign_quality(
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
  if current_app_role() <> 'owner' then
    raise exception 'akses ditolak: hanya owner' using errcode = '42501';
  end if;

  return query
  select imp.* from _get_campaign_quality_impl(p_brand_id, p_from, p_to, p_attribution) as imp;
end;
$$;

-- cs boleh memanggil ini -- halaman "Performa saya" bergantung padanya -- tapi
-- hanya boleh menerima BARISNYA SENDIRI. Sebelum migrasi ini fungsinya
-- mengembalikan baris setiap cs dan penyaringannya dilakukan di
-- app/api/dashboard/cs-performance/route.ts. Filter di TypeScript bukan batas
-- keamanan ketika fungsinya bisa dipanggil langsung dari browser dengan anon
-- key: cs mana pun bisa membaca nama, funnel, jumlah closing, dan tingkat
-- pembatalan rekannya. Pemilik menyatakan eksplisit bahwa antar-CS tidak boleh
-- saling melihat, jadi penyaringannya pindah ke sini.
create function get_cs_performance(
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
  v_is_owner boolean;
begin
  if p_brand_id is distinct from current_brand_id() then
    raise exception 'akses ditolak untuk brand tersebut' using errcode = '42501';
  end if;

  v_is_owner := current_app_role() = 'owner';

  return query
  select imp.*
  from _get_cs_performance_impl(p_brand_id, p_from, p_to) as imp
  where v_is_owner or imp.cs_id = auth.uid();
end;
$$;

create function get_lead_insight_summary(
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
  if current_app_role() <> 'owner' then
    raise exception 'akses ditolak: hanya owner' using errcode = '42501';
  end if;

  return query
  select imp.* from _get_lead_insight_summary_impl(p_brand_id, p_from, p_to) as imp;
end;
$$;

-- ---------------------------------------------------------------------------
-- Langkah 6: grant. Pola sama seperti 019 -- PUBLIC dapat EXECUTE secara
-- default, jadi harus dicabut eksplisit. Impl tidak pernah diberi grant.
-- ---------------------------------------------------------------------------

revoke execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) from public, anon;
revoke execute on function get_campaign_quality(uuid,date,date,text) from public, anon;
revoke execute on function get_cs_performance(uuid,date,date) from public, anon;
revoke execute on function get_lead_insight_summary(uuid,date,date) from public, anon;

grant execute on function get_dashboard_overview(uuid,date,date,text,uuid,uuid) to authenticated;
grant execute on function get_campaign_quality(uuid,date,date,text) to authenticated;
grant execute on function get_cs_performance(uuid,date,date) to authenticated;
grant execute on function get_lead_insight_summary(uuid,date,date) to authenticated;

revoke execute on function _get_dashboard_overview_impl(uuid,date,date,text,uuid,uuid) from public, anon, authenticated;
revoke execute on function _get_campaign_quality_impl(uuid,date,date,text) from public, anon, authenticated;
revoke execute on function _get_cs_performance_impl(uuid,date,date) from public, anon, authenticated;
