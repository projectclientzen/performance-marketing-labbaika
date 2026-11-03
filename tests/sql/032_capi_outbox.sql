-- Disposable LOCAL database only. No external events. Entire fixture rolled back.
begin;
create temp table capi_test_context (brand uuid, other_brand uuid, owner_id uuid, cs_id uuid, other_cs uuid, hrd_id uuid, foreign_owner uuid, program uuid, departure uuid, source uuid);
do $$ declare b uuid; b2 uuid; o uuid := gen_random_uuid(); c uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); h uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); p uuid; d uuid; s uuid;
begin
  insert into brands(name,slug) values ('CAPI test','capi-test-032') returning id into b;
  insert into brands(name,slug) values ('Other test','capi-other-032') returning id into b2;
  insert into auth.users(id) values(o),(c),(c2),(h),(o2);
  insert into app_users(id,brand_id,full_name,role) values(o,b,'Owner','owner'),(c,b,'CS','cs'),(c2,b,'Other CS','cs'),(h,b,'HRD','hrd'),(o2,b2,'Foreign owner','owner');
  insert into lead_sources(brand_id,name,slug) values(b,'CTWA','facebook_ctwa') returning id into s;
  insert into programs(brand_id,name,destination,duration_days) values(b,'Program','X',9) returning id into p;
  insert into program_departures(brand_id,program_id,departure_date) values(b,p,current_date+60) returning id into d;
  insert into capi_test_context values(b,b2,o,c,c2,h,o2,p,d,s);
end $$;
grant select on capi_test_context to authenticated, service_role;
create temp table capi_test_bookings(label text primary key, id uuid);
grant select on capi_test_bookings to authenticated, service_role;

create function pg_temp.make_capi_booking(label text, legacy boolean default false, other_cs boolean default false) returns uuid language plpgsql as $$
declare x capi_test_context%rowtype; booking uuid;
begin
  select * into x from capi_test_context;
  insert into closings(brand_id,cs_id,first_name,whatsapp_raw,lead_date,source_id,previous_stage,closing_date,program_id,departure_id,room_type,pax,price_at_transaction,total_value,payment_status,paid_amount,pdp_consent,pdp_consent_at,first_payment_received_at,created_at)
  values(x.brand,case when other_cs then x.other_cs else x.cs_id end,'Synthetic','081234560032',current_date-2,x.source,'offering',current_date,x.program,x.departure,'quad',2,30000000,60000000,'dp',10000000,true,now(),case when legacy then now()-interval '1 day' else now() end,case when legacy then now()-interval '1 day' else now() end) returning id into booking;
  insert into capi_test_bookings values(label,booking);
  return booking;
end $$;

select pg_temp.make_capi_booking('off');
do $$ begin if exists(select 1 from capi_events where brand_id=(select brand from capi_test_context)) then raise exception 'off must not enqueue'; end if; end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from capi_test_context;
insert into capi_settings(brand_id,mode,dataset_id) select brand,'test','123' from capi_test_context;
reset role;
select pg_temp.make_capi_booking('legacy',true);
select pg_temp.make_capi_booking('valid');
select pg_temp.make_capi_booking('other-cs',false,true);
do $$ begin
  if (select count(*) from capi_events where brand_id=(select brand from capi_test_context))<>2 then raise exception 'new booking enqueues, historical does not'; end if;
  if exists(select 1 from capi_events where brand_id=(select brand from capi_test_context) and value_snapshot<>60000000) then raise exception 'value must be booking value, not DP'; end if;
end $$;

-- CS can read only own event and cannot mutate queue/config or claim worker jobs.
set local role authenticated;
select set_config('request.jwt.claim.sub',cs_id::text,true) from capi_test_context;
do $$ begin
  if (select count(*) from capi_events)<>1 then raise exception 'CS event isolation'; end if;
  if exists(select 1 from capi_settings) then raise exception 'CS cannot see config'; end if;
  begin perform claim_capi_events((select brand from capi_test_context),3,604800); raise exception 'CS worker invocation allowed'; exception when insufficient_privilege then null; end;
  begin update capi_events set status='accepted'; raise exception 'CS mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
update v_closings_cs set paid_amount=20000000,payment_status='partial' where id=(select id from capi_test_bookings where label='valid');
do $$ begin if (select count(*) from capi_events)<>1 then raise exception 'installment duplicated'; end if; end $$;
select set_config('request.jwt.claim.sub',hrd_id::text,true) from capi_test_context;
do $$ begin
  if exists(select 1 from capi_settings) or exists(select 1 from capi_events) then raise exception 'HRD integration access'; end if;
  begin insert into capi_settings(brand_id,mode) select brand,'off' from capi_test_context; raise exception 'HRD settings write'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',foreign_owner::text,true) from capi_test_context;
do $$ begin if exists(select 1 from capi_settings) or exists(select 1 from capi_events) then raise exception 'cross brand leak'; end if; end $$;
reset role;

-- A worker cannot claim another brand; live/test only; outstanding lease not claimed again.
set local role service_role;
do $$ begin if exists(select 1 from claim_capi_events((select other_brand from capi_test_context),3,604800)) then raise exception 'cross brand worker claim'; end if; end $$;
select count(*) from claim_capi_events((select brand from capi_test_context),1,604800);
do $$ declare x capi_events%rowtype; begin
  select * into x from capi_events where brand_id=(select brand from capi_test_context) and status='processing';
  if x.id is null then raise exception 'worker did not claim'; end if;
  if complete_capi_event(x.id,gen_random_uuid(),'accepted') then raise exception 'wrong lease accepted'; end if;
  if not complete_capi_event(x.id,x.lease_token,'accepted') then raise exception 'valid completion failed'; end if;
  if complete_capi_event(x.id,x.lease_token,'accepted') then raise exception 'duplicate completion accepted'; end if;
end $$;
select count(*) from claim_capi_events((select brand from capi_test_context),3,604800);
do $$ begin if exists(select 1 from claim_capi_events((select brand from capi_test_context),3,604800)) then raise exception 'leased event re-claimed'; end if; end $$;
reset role;
update capi_events set lease_until=now()-interval '1 minute' where brand_id=(select brand from capi_test_context) and status='processing';
set local role service_role;
select count(*) from claim_capi_events((select brand from capi_test_context),3,604800);
do $$ begin if not exists(select 1 from capi_events where last_error='lease_expired_delivery_unknown' and brand_id=(select brand from capi_test_context)) then raise exception 'ambiguous timeout not held'; end if; end $$;
reset role;

select pg_temp.make_capi_booking('refund');
update closings set payment_status='refunded' where id=(select id from capi_test_bookings where label='refund');
select pg_temp.make_capi_booking('revoke');
update closings set pdp_consent=false where id=(select id from capi_test_bookings where label='revoke');
do $$ begin if (select count(*) from capi_events where brand_id=(select brand from capi_test_context) and status='cancelled')<>2 then raise exception 'refund and revocation did not stop pending'; end if; end $$;
select pg_temp.make_capi_booking('change');
update closings set total_value=61000000 where id=(select id from capi_test_bookings where label='change');
do $$ begin if not exists(select 1 from capi_events where closing_id=(select id from capi_test_bookings where label='change') and status='held' and value_snapshot=60000000) then raise exception 'snapshot changed silently'; end if; end $$;
select pg_temp.make_capi_booking('identity-change');
update closings set email='updated@example.invalid' where id=(select id from capi_test_bookings where label='identity-change');
do $$ begin if not exists(select 1 from capi_events where closing_id=(select id from capi_test_bookings where label='identity-change') and status='held') then raise exception 'customer identity changed silently'; end if; end $$;
do $$ begin
  begin update closings set paid_amount=0 where id=(select id from capi_test_bookings where label='valid'); raise exception 'zero verified DP accepted'; exception when check_violation then null; end;
  begin update closings set first_payment_received_at=now()+interval '1 day' where id=(select id from capi_test_bookings where label='valid'); raise exception 'future DP accepted'; exception when check_violation then null; end;
end $$;

-- Mode change holds outstanding jobs; dry run never claimed and never promoted into live.
update capi_settings set mode='dry_run' where brand_id=(select brand from capi_test_context);
select pg_temp.make_capi_booking('dry');
set local role service_role;
do $$ begin if exists(select 1 from claim_capi_events((select brand from capi_test_context),3,604800)) then raise exception 'dry run claimed'; end if; end $$;
reset role;
update capi_settings set mode='live' where brand_id=(select brand from capi_test_context);
update closings set paid_amount=30000000 where id=(select id from capi_test_bookings where label='dry');
do $$ begin
  if (select count(*) from capi_events where closing_id=(select id from capi_test_bookings where label='dry'))<>1 then raise exception 'dry event promoted/recreated'; end if;
  if (select count(*) from capi_events where brand_id=(select brand from capi_test_context) and status='accepted')<>1 then raise exception 'accepted audit lost'; end if;
end $$;

-- R1: a booking cancelled while its request is in flight must not erase Meta's acceptance.
select pg_temp.make_capi_booking('inflight');
set local role service_role;
create temp table capi_inflight as select * from claim_capi_events((select brand from capi_test_context),1,604800);
reset role;
do $$ begin if (select count(*) from capi_inflight)<>1 then raise exception 'in-flight fixture not claimed'; end if; end $$;
update closings set payment_status='cancelled' where id=(select id from capi_test_bookings where label='inflight');
do $$ begin
  if not exists(select 1 from capi_events where closing_id=(select id from capi_test_bookings where label='inflight')
    and status='held' and last_error='cancelled_during_delivery' and lease_token is not null) then
    raise exception 'in-flight cancel must hold and keep lease';
  end if;
end $$;
set local role service_role;
do $$ begin if not (select complete_capi_event(id,lease_token,'accepted') from capi_inflight) then raise exception 'late acceptance not recorded'; end if; end $$;
reset role;
do $$ begin
  if not exists(select 1 from capi_events where closing_id=(select id from capi_test_bookings where label='inflight')
    and status='accepted' and accepted_at is not null and last_error='accepted_after_booking_change') then
    raise exception 'late acceptance must be accepted and flagged';
  end if;
end $$;

-- R1b: an in-flight row held by a value change keeps its hold reason when Meta did not accept.
select pg_temp.make_capi_booking('inflight-change');
set local role service_role;
create temp table capi_inflight2 as select * from claim_capi_events((select brand from capi_test_context),1,604800);
reset role;
update closings set total_value=62000000, price_at_transaction=31000000 where id=(select id from capi_test_bookings where label='inflight-change');
set local role service_role;
do $$ begin if not (select complete_capi_event(id,lease_token,'held','delivery_unknown') from capi_inflight2) then raise exception 'held completion not recorded'; end if; end $$;
reset role;
do $$ begin
  if not exists(select 1 from capi_events where closing_id=(select id from capi_test_bookings where label='inflight-change')
    and status='held' and last_error='snapshot_changed' and lease_token is null) then
    raise exception 'non-accepted completion must keep hold reason and release lease';
  end if;
end $$;

-- R2: a booking ineligible at insert (inconsistent value) is queued once after correction.
do $$ declare x capi_test_context%rowtype; booking uuid; begin
  select * into x from capi_test_context;
  insert into closings(brand_id,cs_id,first_name,whatsapp_raw,lead_date,source_id,previous_stage,closing_date,program_id,departure_id,room_type,pax,price_at_transaction,total_value,payment_status,paid_amount,pdp_consent,pdp_consent_at,first_payment_received_at)
  values(x.brand,x.cs_id,'Synthetic','081234560033',current_date-2,x.source,'offering',current_date,x.program,x.departure,'quad',2,30000000,59000000,'dp',10000000,true,now(),now()) returning id into booking;
  insert into capi_test_bookings values('mismatch',booking);
  if exists(select 1 from capi_events where closing_id=booking) then raise exception 'inconsistent value queued'; end if;
  update closings set total_value=60000000 where id=booking;
  if (select count(*) from capi_events where closing_id=booking and value_snapshot=60000000)<>1 then raise exception 'corrected booking not queued'; end if;
  update closings set paid_amount=20000000, payment_status='partial' where id=booking;
  if (select count(*) from capi_events where closing_id=booking)<>1 then raise exception 'installment after correction duplicated'; end if;
end $$;

-- P1.1: coverage shows why new bookings are not queued; owner/advertiser only, own brand only.
do $$ declare x capi_test_context%rowtype; begin
  select * into x from capi_test_context;
  insert into closings(brand_id,cs_id,first_name,whatsapp_raw,lead_date,source_id,previous_stage,closing_date,program_id,departure_id,room_type,pax,price_at_transaction,total_value,payment_status,paid_amount,pdp_consent,pdp_consent_at)
  values(x.brand,x.cs_id,'Synthetic','081234560034',current_date-2,x.source,'offering',current_date,x.program,x.departure,'quad',2,30000000,60000000,'dp',10000000,true,now());
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from capi_test_context;
do $$ begin
  if coalesce((select bookings from capi_coverage((select brand from capi_test_context)) where reason='first_payment_time_missing'),0)<1 then
    raise exception 'coverage misses booking without payment time';
  end if;
  begin perform capi_coverage((select other_brand from capi_test_context)); raise exception 'coverage cross brand'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',cs_id::text,true) from capi_test_context;
do $$ begin begin perform capi_coverage((select brand from capi_test_context)); raise exception 'CS coverage access'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub',hrd_id::text,true) from capi_test_context;
do $$ begin begin perform capi_coverage((select brand from capi_test_context)); raise exception 'HRD coverage access'; exception when insufficient_privilege then null; end; end $$;

-- P1.2: reconciliation is owner/advertiser only, needs a note, held rows only, and is audited.
select set_config('request.jwt.claim.sub',cs_id::text,true) from capi_test_context;
do $$ begin
  begin perform resolve_capi_event((select id from capi_events where closing_id=(select id from capi_test_bookings where label='change')),'confirmed_not_received','cek events manager'); raise exception 'CS reconciliation'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',owner_id::text,true) from capi_test_context;
do $$ declare ev uuid; begin
  select id into ev from capi_events where closing_id=(select id from capi_test_bookings where label='change');
  begin perform resolve_capi_event(ev,'confirmed_not_received','short'); raise exception 'note not required'; exception when invalid_parameter_value then null; end;
  perform resolve_capi_event(ev,'confirmed_not_received','Events Manager: tidak ada event untuk ID ini');
  begin perform resolve_capi_event(ev,'confirmed_received','Events Manager: tidak ada event untuk ID ini'); raise exception 'resolved twice'; exception when object_not_in_prerequisite_state then null; end;
  begin perform resolve_capi_event((select id from capi_events where status='accepted' limit 1),'confirmed_not_received','Events Manager: diterima normal'); raise exception 'accepted row reconciled'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from capi_events where closing_id=(select id from capi_test_bookings where label='change') and status='cancelled' and last_error='reconciled_not_received') then raise exception 'reconciliation not applied'; end if;
  if not exists(select 1 from audit_logs where action='capi_reconcile' and user_id=(select owner_id from capi_test_context)) then raise exception 'reconciliation not audited'; end if;
end $$;

-- P1.3: settings changes carry the actor; worker runs are visible to owner, not to CS.
do $$ begin
  if not exists(select 1 from audit_logs where table_name='capi_settings' and user_id=(select owner_id from capi_test_context) and new_value->>'mode'='test') then
    raise exception 'settings change not audited with actor';
  end if;
end $$;
set local role service_role;
insert into capi_worker_runs(brand_id,mode,outcome,claimed,accepted) select brand,'live','ok',1,1 from capi_test_context;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from capi_test_context;
do $$ begin if (select count(*) from capi_worker_runs)<>1 then raise exception 'owner cannot see worker runs'; end if; end $$;
select set_config('request.jwt.claim.sub',cs_id::text,true) from capi_test_context;
do $$ begin if exists(select 1 from capi_worker_runs) then raise exception 'CS sees worker runs'; end if; end $$;
reset role;
rollback;
