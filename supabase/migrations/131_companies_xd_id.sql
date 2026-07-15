-- Migration 131: Add xd_id to companies table
-- xd_id is the XDrive platform identifier shown to drivers (e.g. XD-A1B2C3D4),
-- replacing the raw Companies House company_number in all driver-facing views.

-- 1. Add column (nullable initially so backfill can run)
alter table public.companies
  add column if not exists xd_id text;

-- 2. Backfill all existing companies
update public.companies
set xd_id = 'XD-' || upper(substring(id::text, 1, 8))
where xd_id is null;

-- 3. Set default for future rows
alter table public.companies
  alter column xd_id set default ('XD-' || upper(substring(gen_random_uuid()::text, 1, 8)));

-- 4. Add unique constraint (soft — allows null in theory, but backfill covers existing rows)
create unique index if not exists companies_xd_id_unique on public.companies (xd_id);
