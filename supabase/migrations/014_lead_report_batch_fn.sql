-- 014_lead_report_batch_fn.sql
-- CC-B16 support: create_lead_report_batch — atomic multi-block insert.
-- Ref: 04-BRIEF-BE.md §6 ("Kalau satu blok gagal validasi, tidak ada yang
-- tersimpan"), §2.3 (idempotency_key is a per-row column on lead_reports).
--
-- The API accepts one client-generated idempotency_key per request
-- (matching the brief's POST body shape), covering possibly several blocks.
-- Since the DB's uniqueness is per-row (one lead_reports row = one block),
-- this derives a per-block key as "<key>:<index>" so a full-payload retry
-- with the same key is safely a no-op via ON CONFLICT, while a single
-- top-level key still satisfies the "one key per submit" API contract.
--
-- Atomicity: a plpgsql function body is one transaction from the caller's
-- point of view — if any block fails validation, the exception aborts the
-- whole call and every insert in this loop is rolled back, not just the
-- failing one.

create or replace function create_lead_report_batch(
  p_brand_id uuid,
  p_cs_id uuid,
  p_report_date date,
  p_blocks jsonb,
  p_idempotency_key text
) returns setof lead_reports
language plpgsql
as $$
declare
  v_block jsonb;
  v_index int := 0;
  v_block_key text;
begin
  for v_block in select * from jsonb_array_elements(p_blocks)
  loop
    v_block_key := case
      when p_idempotency_key is null then null
      else p_idempotency_key || ':' || v_index
    end;

    insert into lead_reports (
      brand_id, cs_id, report_date, source_id, campaign_id,
      total_lead, cold, consultation, offering, idempotency_key,
      created_by, updated_by
    ) values (
      p_brand_id, p_cs_id, p_report_date,
      (v_block ->> 'source_id')::uuid,
      nullif(v_block ->> 'campaign_id', '')::uuid,
      (v_block ->> 'total_lead')::int,
      (v_block ->> 'cold')::int,
      (v_block ->> 'consultation')::int,
      (v_block ->> 'offering')::int,
      v_block_key,
      p_cs_id, p_cs_id
    )
    on conflict (brand_id, idempotency_key) where idempotency_key is not null do nothing;

    v_index := v_index + 1;
  end loop;

  return query
    select r.* from lead_reports r
    where r.brand_id = p_brand_id
      and r.cs_id = p_cs_id
      and r.report_date = p_report_date
      and (
        p_idempotency_key is null
        or r.idempotency_key like p_idempotency_key || ':%'
      );
end;
$$;
