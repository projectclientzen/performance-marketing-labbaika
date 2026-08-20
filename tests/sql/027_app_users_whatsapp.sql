-- Proof for 027_add_app_users_whatsapp.sql: column exists, is nullable
-- (existing rows have no WA number and shouldn't error), and an owner can
-- insert a new app_users row carrying it through their own RLS-scoped
-- client (not superuser) — same identity the real POST /api/users route
-- inserts through.

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-027-test');
insert into auth.users (id) values (gen_random_uuid());

do $$
declare v_brand uuid; v_owner uuid; v_new_cs uuid;
begin
  select id into v_brand from brands where slug = 'labbaika-027-test';
  select id into v_owner from auth.users order by id desc limit 1;

  insert into app_users (id, brand_id, full_name, role) values (v_owner, v_brand, 'Owner', 'owner');

  create temp table t027_ids as select v_brand as brand_id, v_owner as owner_id;
  grant select on t027_ids to authenticated;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', owner_id::text, false) from t027_ids;

do $$
declare v_brand uuid; v_new_id uuid := gen_random_uuid(); v_wa text;
begin
  select brand_id into v_brand from t027_ids;

  insert into app_users (id, brand_id, full_name, whatsapp, role)
  values (v_new_id, v_brand, 'CS Baru', '+6281234500099', 'cs');

  select whatsapp into v_wa from app_users where id = v_new_id;
  if v_wa <> '+6281234500099' then
    raise exception 'TEST FAILED: whatsapp tersimpan salah, got %', v_wa;
  end if;
  raise notice 'TEST 1 PASSED: owner insert app_users dengan whatsapp lewat RLS berhasil, nilai tersimpan benar';
end $$;

-- existing rows (no whatsapp yet) must not have broken
do $$
declare v_null_wa boolean;
begin
  select whatsapp is null into v_null_wa from t027_ids join app_users on app_users.id = t027_ids.owner_id;
  if not v_null_wa then
    raise exception 'TEST FAILED: expected pre-existing owner row to have null whatsapp';
  end if;
  raise notice 'TEST 2 PASSED: kolom whatsapp nullable, baris lama tidak rusak';
end $$;

reset role;
rollback;
