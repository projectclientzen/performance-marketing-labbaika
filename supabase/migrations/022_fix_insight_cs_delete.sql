-- Fix for 10-AUDIT-FE-BE.md #5: cs has no DELETE policy on
-- lead_report_insights. app/api/lead-reports/[id]/insights/route.ts uses a
-- replace-all strategy (delete matching stages, then insert the new set).
-- RLS does not error when a DELETE is denied -- it just matches 0 rows --
-- so the delete silently no-ops for cs, and the following insert collides
-- with lead_report_insights_uniq (lead_report_id, stage, category_id) on
-- every save after the first. Mirrors lead_report_insights_cs_update
-- (013_rls.sql:134): same ownership check, delete instead of update.
--
-- 013_rls.sql:271-275 also never granted DELETE on this table to
-- `authenticated` at all (only select/insert/update) -- confirmed against a
-- local test db: "permission denied for table lead_report_insights" even
-- with the RLS policy below in place, since the table-level grant is
-- checked before RLS gets a chance to filter rows.

create policy lead_report_insights_cs_delete on lead_report_insights for delete
  using (
    brand_id = current_brand_id()
    and exists (select 1 from lead_reports r where r.id = lead_report_id and r.cs_id = auth.uid())
  );

grant delete on lead_report_insights to authenticated;
