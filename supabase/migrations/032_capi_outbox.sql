-- 032: first verified payment -> ONE Purchase at FULL booking value.
-- No credentials, network calls, historical backfill, or activation on migration.
-- service_role is a standard Supabase role (local tests must bootstrap it).
begin;

alter table closings add column if not exists first_payment_received_at timestamptz;
comment on column closings.first_payment_received_at is
  'Actual verified first payment time; never inferred from import/create time. Nullable for legacy records.';

create or replace view v_closings_cs as
select id, brand_id, cs_id, first_name, last_name, whatsapp_e164, email,
  pdp_consent, pdp_consent_at, lead_date, source_id, campaign_id,
  lead_report_id, previous_stage, closing_date, program_id, departure_id,
  room_type, pax, price_at_transaction, total_value, is_price_override,
  price_note, payment_status, paid_amount, cancelled_at, cancel_reason,
  province_id, city_id, address, interval_days, created_at, updated_at,
  first_payment_received_at
from closings
where brand_id = current_brand_id() and cs_id = auth.uid()
with cascaded check option;
grant select, update on v_closings_cs to authenticated;

create table capi_settings (
  brand_id uuid primary key references brands(id),
  mode text not null default 'off' check (mode in ('off','dry_run','test','live')),
  dataset_id text check (dataset_id ~ '^[0-9]+$'),
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capi_enabled check (mode = 'off' or enabled_at is not null),
  constraint capi_dataset check (mode not in ('test','live') or dataset_id is not null)
);
create table capi_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  closing_id uuid not null references closings(id),
  event_id text not null,
  mode text not null check (mode in ('dry_run','test','live')),
  status text not null default 'pending'
    check (status in ('pending','processing','accepted','failed','held','cancelled')),
  value_snapshot bigint not null check (value_snapshot > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  event_time timestamptz not null,
  attempt_count int not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, closing_id, mode),
  constraint capi_event_identity check (event_id = 'labbaika:booking:' || closing_id::text || ':purchase:v1')
);
create index capi_events_claim_idx on capi_events(next_attempt_at)
  where status in ('pending','failed');
create index capi_events_brand_idx on capi_events(brand_id, created_at desc);

alter table capi_settings enable row level security;
alter table capi_settings force row level security;
create policy capi_settings_manage on capi_settings for all to authenticated
  using (brand_id = current_brand_id() and current_app_role()::text in ('owner','advertiser') and exists(select 1 from app_users where id = auth.uid() and is_active))
  with check (brand_id = current_brand_id() and current_app_role()::text in ('owner','advertiser') and exists(select 1 from app_users where id = auth.uid() and is_active));
alter table capi_events enable row level security;
alter table capi_events force row level security;
create policy capi_events_read on capi_events for select to authenticated
using (brand_id = current_brand_id() and exists(select 1 from app_users where id = auth.uid() and is_active) and (
  current_app_role()::text in ('owner','advertiser') or
  (current_app_role()::text = 'cs' and closing_id in (select id from v_closings_cs))
));
revoke all on capi_settings, capi_events from anon, authenticated;
grant select, insert, update on capi_settings to authenticated;
grant select on capi_events to authenticated;
grant all on capi_settings, capi_events to service_role;
grant select on closings to service_role;

create function capi_settings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Activation time is server-owned and cannot be backdated by a client.
  if TG_OP = 'INSERT' then
    new.enabled_at := case when new.mode <> 'off' then now() else null end;
  elsif new.mode is distinct from old.mode or new.dataset_id is distinct from old.dataset_id then
    new.enabled_at := case when new.mode <> 'off' then now() else null end;
    update capi_events set status = 'held', last_error = 'settings_changed',
      lease_until = null, lease_token = null, updated_at = now()
    where brand_id = new.brand_id and status in ('pending','failed','processing');
  else
    new.enabled_at := old.enabled_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger capi_settings_before_write before insert or update on capi_settings
for each row execute function capi_settings_guard();

create function capi_validate_payment_time() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.first_payment_received_at is not null and (
    not isfinite(new.first_payment_received_at) or
    new.first_payment_received_at > clock_timestamp() or
    (new.first_payment_received_at at time zone 'Asia/Jakarta')::date < new.lead_date
  ) then
    raise exception 'Invalid actual first payment time' using errcode = '23514';
  end if;
  if new.first_payment_received_at is not null and new.payment_status in ('dp','partial','lunas')
    and (new.paid_amount <= 0 or new.total_value <= 0 or
      (new.payment_status = 'lunas' and new.paid_amount <> new.total_value)) then
    raise exception 'Verified payment requires positive amount; settled amount must equal booking value' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger capi_payment_before_write before insert or update on closings
for each row execute function capi_validate_payment_time();

create function capi_queue_closing() returns trigger
language plpgsql security definer set search_path = public as $$
declare s capi_settings%rowtype;
begin
  -- Accepted events remain an immutable delivery history; cancellation is not a Meta reversal.
  if new.payment_status in ('cancelled','refunded') or not new.pdp_consent or new.pdp_consent_at is null then
    update capi_events set status = 'cancelled', last_error = 'booking_ineligible',
      lease_until = null, lease_token = null, updated_at = now()
    where closing_id = new.id and status <> 'accepted';
    return new;
  end if;
  -- Corrections are held for review; a queued payload must not silently change.
  if TG_OP = 'UPDATE' and (new.total_value is distinct from old.total_value or
    new.first_payment_received_at is distinct from old.first_payment_received_at or
    new.whatsapp_e164 is distinct from old.whatsapp_e164 or new.email is distinct from old.email or
    new.pdp_consent_at is distinct from old.pdp_consent_at or new.program_id is distinct from old.program_id or
    new.pax is distinct from old.pax or new.price_at_transaction is distinct from old.price_at_transaction) then
    update capi_events set status = 'held', last_error = 'snapshot_changed',
      lease_until = null, lease_token = null, updated_at = now()
    where closing_id = new.id and status in ('pending','failed','processing');
  end if;
  if new.first_payment_received_at is null or new.payment_status not in ('dp','partial','lunas')
    or new.paid_amount <= 0 or new.paid_amount > new.total_value or new.total_value <= 0
    or not isfinite(new.pdp_consent_at) or new.pdp_consent_at > now()
    or new.price_at_transaction <= 0 or new.pax <= 0
    or (not new.is_price_override and new.total_value <> new.price_at_transaction * new.pax)
    or (new.is_price_override and nullif(trim(new.price_note), '') is null) then return new; end if;
  -- Subsequent installment/profile edits and mode changes do not create another event.
  if TG_OP = 'UPDATE' and old.first_payment_received_at is not null and old.paid_amount > 0
    and old.payment_status in ('dp','partial','lunas') and old.pdp_consent
    and old.pdp_consent_at is not null then return new; end if;
  select * into s from capi_settings where brand_id = new.brand_id for share;
  if not found or s.mode = 'off' or new.created_at < s.enabled_at
    or new.first_payment_received_at < s.enabled_at then return new; end if;
  -- No resurrection across modes, including cancelled/held records.
  if exists(select 1 from capi_events where closing_id = new.id) then return new; end if;
  insert into capi_events(brand_id, closing_id, event_id, mode, value_snapshot, event_time)
  values(new.brand_id, new.id, 'labbaika:booking:' || new.id::text || ':purchase:v1',
    s.mode, new.total_value, new.first_payment_received_at)
  on conflict (brand_id, closing_id, mode) do nothing;
  return new;
end $$;
create trigger capi_closing_after_write after insert or update on closings
for each row execute function capi_queue_closing();

create function claim_capi_events(p_brand_id uuid, p_limit int default 3, p_max_age_seconds int default 604800) returns setof capi_events
language plpgsql security definer set search_path = public as $$
begin
  if p_brand_id is null or p_limit < 1 or p_limit > 10 or p_max_age_seconds <= 0 then raise exception 'Invalid claim parameters'; end if;
  -- A crashed sender may already have delivered. Never automatically resend an ambiguous outcome.
  update capi_events set status = 'held', last_error = 'lease_expired_delivery_unknown',
    lease_token = null, lease_until = null, updated_at = now()
  where brand_id = p_brand_id and status = 'processing' and lease_until < now();
  update capi_events e set status = 'held', last_error = 'preflight_ineligible', updated_at = now()
  where e.brand_id = p_brand_id and e.status in ('pending','failed') and e.mode in ('test','live') and not exists (
    select 1 from closings c join capi_settings s on s.brand_id = c.brand_id
    where c.id = e.closing_id and c.brand_id = e.brand_id and s.mode = e.mode
      and s.dataset_id is not null and c.created_at >= s.enabled_at
      and c.first_payment_received_at >= s.enabled_at
      and c.first_payment_received_at = e.event_time and e.event_time <= now()
      and e.event_time >= now() - make_interval(secs => p_max_age_seconds)
      and c.total_value = e.value_snapshot and c.paid_amount > 0 and c.paid_amount <= c.total_value
      and c.payment_status in ('dp','partial','lunas') and c.pdp_consent
      and c.pdp_consent_at is not null and c.pdp_consent_at <= now()
  );
  return query with candidates as (
    select id from capi_events where brand_id = p_brand_id and status in ('pending','failed') and mode in ('test','live')
      and next_attempt_at <= now() and attempt_count < 5
    order by next_attempt_at, id limit p_limit for update skip locked
  ) update capi_events e set status = 'processing', attempt_count = e.attempt_count + 1,
    lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes', updated_at = now()
  from candidates c where e.id = c.id returning e.*;
end $$;

create function complete_capi_event(p_id uuid, p_lease_token uuid, p_status text, p_error text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_status not in ('accepted','failed','held') then raise exception 'Invalid completion status'; end if;
  update capi_events set
    status = case when p_status = 'failed' and attempt_count >= 5 then 'held' else p_status end,
    accepted_at = case when p_status = 'accepted' then now() else null end,
    -- Store only caller-defined machine codes, NEVER response bodies/tokens/PII.
    last_error = case when p_status = 'accepted' then null
      when p_error ~ '^[a-z_]{1,64}$' then p_error else 'delivery_error_redacted' end,
    next_attempt_at = now() + make_interval(secs => least(3600, 60 * (2 ^ attempt_count)::int)),
    lease_token = null, lease_until = null, updated_at = now()
  where id = p_id and status = 'processing' and lease_token = p_lease_token and lease_until >= now();
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke execute on function capi_settings_guard(), capi_validate_payment_time(), capi_queue_closing(),
  claim_capi_events(uuid,int,int), complete_capi_event(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function claim_capi_events(uuid,int,int), complete_capi_event(uuid,uuid,text,text) to service_role;
commit;
