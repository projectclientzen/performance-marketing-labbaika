-- 006_system_tables.sql
-- CC-B07: period_locks, export_logs, sync_logs, audit_logs
-- Ref: 04-BRIEF-BE.md §2.6.

create table period_locks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  year int not null,
  month int not null,
  locked_at timestamptz not null default now(),
  locked_by uuid references app_users (id),
  unlock_reason text,

  constraint period_locks_month_range check (month between 1 and 12)
);

create unique index period_locks_uniq on period_locks (brand_id, year, month);

create table export_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  user_id uuid references app_users (id),
  export_type text not null,
  filters jsonb,
  row_count int not null default 0,
  created_at timestamptz not null default now()
);

create index export_logs_brand_id_idx on export_logs (brand_id);

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  source text not null,
  status text not null,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index sync_logs_brand_id_idx on sync_logs (brand_id);

-- Written exclusively by trigger T-5 (CC-B12); no direct app writes.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id),
  user_id uuid references app_users (id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index audit_logs_brand_id_idx on audit_logs (brand_id);
create index audit_logs_table_record_idx on audit_logs (table_name, record_id);
create index audit_logs_created_at_idx on audit_logs (created_at);
