-- Rollback for 017_fix_resolve_link_campaign.sql. Not auto-applied by Supabase CLI.
-- Restores the pre-fix (ambiguous) matching from migration 007.

create or replace function resolve_lead_report_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_report_id is null then
    select id into new.lead_report_id
    from lead_reports
    where brand_id = new.brand_id
      and cs_id = new.cs_id
      and report_date = new.lead_date
      and source_id = new.source_id
    limit 1;
  end if;
  return new;
end;
$$;
