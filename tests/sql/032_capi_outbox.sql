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
rollback;
