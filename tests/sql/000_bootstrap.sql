-- LOCAL-ONLY bootstrap for running tests/sql/*.sql against a plain Postgres
-- instance that has no Supabase `auth` schema. NEVER run this against a real
-- Supabase project -- it would try to create objects that already exist
-- there (auth.users, auth.uid()) and could shadow the real ones.
--
-- Mirrors Supabase's real auth.uid() (confirmed live on ymnttmqfwzrhqpnewbeo
-- via `select prosrc from pg_proc where proname='uid' and pronamespace=
-- 'auth'::regnamespace`): reads the `sub` claim off the request JWT. Tests
-- impersonate a user with `select set_config('request.jwt.claim.sub',
-- '<uuid>', false);` after `set role authenticated` -- the exact call
-- PostgREST makes per-request on a real project, so a policy that passes
-- here passes there too. An earlier version of this file's tests used a
-- bespoke `app.test_uid` GUC instead: it worked locally (this file defined
-- auth.uid() to read it) but silently produced auth.uid() = NULL if anyone
-- ever pointed the same .sql file at a real Supabase database, since
-- Supabase's actual auth.uid() has never heard of app.test_uid. RLS does
-- not error on a NULL identity, it just matches 0 rows -- so negative
-- assertions ("other user can't touch this row") stayed green for the
-- wrong reason, and positive assertions failed loudly enough to have been
-- caught, but only if anyone had actually run these files against a real
-- project instead of a local db built from this bootstrap. Nobody had.

create extension if not exists pgcrypto;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
