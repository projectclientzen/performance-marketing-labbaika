-- 007_trigger_whatsapp_link.sql
-- CC-B08: normalize_wa_id() + T-6 normalize_whatsapp + T-2 resolve_lead_report_link
-- Ref: 04-BRIEF-BE.md §3 (T-2, T-6).
--
-- Test cases here MUST match lib/utils/phone-id.test.ts (DS-07) exactly —
-- 06-TASKS-DeepSeek-Minor.md "Titik serah terima" #1: on mismatch, SQL wins.

create or replace function normalize_wa_id(input text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  result text;
begin
  if input is null then
    return null;
  end if;

  -- strip whitespace, hyphens, parentheses
  cleaned := regexp_replace(input, '[\s\-\(\)]', '', 'g');

  if cleaned = '' then
    return null;
  end if;

  if cleaned like '+62%' then
    result := cleaned;
  elsif cleaned like '62%' then
    result := '+' || cleaned;
  elsif cleaned like '0%' then
    result := '+62' || substring(cleaned from 2);
  elsif cleaned like '8%' then
    result := '+62' || cleaned;
  else
    return null;
  end if;

  if result ~ '^\+62[8][1-9][0-9]{6,10}$' then
    return result;
  end if;

  return null;
end;
$$;

create or replace function normalize_whatsapp()
returns trigger
language plpgsql
as $$
declare
  normalized text;
begin
  normalized := normalize_wa_id(new.whatsapp_raw);
  if normalized is null then
    raise exception 'Nomor WhatsApp tidak valid: %', new.whatsapp_raw
      using errcode = '22023';
  end if;
  new.whatsapp_e164 := normalized;
  return new;
end;
$$;

create trigger trg_b1_normalize_whatsapp
  before insert or update on closings
  for each row execute function normalize_whatsapp();

create or replace function resolve_lead_report_link()
returns trigger
language plpgsql
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

create trigger trg_b2_resolve_lead_report_link
  before insert on closings
  for each row execute function resolve_lead_report_link();
