-- 001_enums_and_master.sql
-- CC-B02: enum types + master tables (brands, app_users, regions, lead_sources, insight_categories)
-- Ref: 04-BRIEF-BE.md §2.1

create extension if not exists "btree_gist";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('owner', 'cs');

-- Bucket stage a lead sits in (furthest stage reached). See 02-PRD-v1.3.md §3.1.
create type lead_stage as enum ('cold', 'consultation', 'offering', 'closing');

create type room_type as enum ('quad', 'triple', 'double', 'child', 'infant');

create type payment_status as enum ('dp', 'partial', 'lunas', 'cancelled', 'refunded');

create type ad_level as enum ('account', 'campaign', 'adset', 'ad');

create type region_level as enum ('province', 'city');

-- ---------------------------------------------------------------------------
-- Master tables
-- ---------------------------------------------------------------------------

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- id mirrors auth.users(id): one Supabase auth identity per app user.
create table app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  brand_id uuid not null references brands (id),
  full_name text not null,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index app_users_brand_id_idx on app_users (brand_id);

-- Kemendagri administrative codes used directly as id where available (see
-- 01-AUDIT-PRD.md P2-19), so id is text rather than uuid.
create table regions (
  id text primary key,
  level region_level not null,
  name text not null,
  parent_id text references regions (id)
);

create index regions_parent_id_idx on regions (parent_id);
create index regions_level_idx on regions (level);

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  unique (brand_id, slug)
);

create table insight_categories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  unique (brand_id, slug)
);
