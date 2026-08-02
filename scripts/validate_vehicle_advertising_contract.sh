#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_SQL="$REPO_ROOT/supabase/migrations/20260802073000_vehicle_advertising_contract.sql"
CONTAINER_NAME="xdrive-vehicle-advertising-contract-$RANDOM"
PGPORT="${PGPORT:-55438}"
PGHOST=127.0.0.1
PGUSER=postgres
PGPASSWORD=postgres
export PGPASSWORD

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_pg() {
  for _ in {1..90}; do
    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c 'select 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Postgres did not become ready in time" >&2
  return 1
}

run_sql() {
  local db="$1"
  local sql="$2"
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -c "$sql"
}

run_file() {
  local db="$1"
  local file="$2"
  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -f "$file"
}

setup_prereq_schema() {
  local db="$1"
  run_sql "$db" "create schema if not exists auth;"
  run_sql "$db" "
    do \$\$
    begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin;
      end if;
    end;
    \$\$;
  "
  run_sql "$db" "
    create table if not exists auth.users (
      id uuid primary key,
      email text
    );

    create or replace function auth.uid()
    returns uuid
    language plpgsql
    stable
    as \$\$
    declare
      v_sub text;
      v_claims text;
    begin
      v_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
      if v_sub is not null then
        return v_sub::uuid;
      end if;

      v_claims := nullif(current_setting('request.jwt.claims', true), '');
      if v_claims is not null then
        return (v_claims::jsonb ->> 'sub')::uuid;
      end if;

      return null;
    end;
    \$\$;

    create table if not exists public.company_memberships (
      id uuid primary key,
      company_id uuid not null,
      user_id uuid not null,
      status text not null,
      role_in_company text not null
    );

    create table if not exists public.drivers (
      id uuid primary key,
      user_id uuid not null,
      company_id uuid not null
    );

    create table if not exists public.vehicles (
      id uuid primary key,
      company_id uuid not null,
      assigned_driver_id uuid null
    );

    create table if not exists public.owner_audit_log (
      id bigserial primary key,
      actor_user_id uuid,
      target_company_id uuid,
      target_type text,
      target_id uuid,
      target_name text,
      action_type text,
      old_status text,
      new_status text,
      reason text,
      created_at timestamptz not null default now()
    );
  "
}

run_as_authenticated() {
  local db="$1"
  local user_id="$2"
  local sql="$3"

  run_sql "$db" "
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '$user_id', true);
    select set_config('request.jwt.claims', json_build_object('sub', '$user_id')::text, true);
    $sql
    commit;
  "
}

seed_contract_fixtures() {
  local db="$1"
  run_sql "$db" "
    insert into auth.users (id, email) values
      ('00000000-0000-0000-0000-000000000001', 'owner@example.com'),
      ('00000000-0000-0000-0000-000000000002', 'dispatcher@example.com'),
      ('00000000-0000-0000-0000-000000000003', 'outsider@example.com'),
      ('00000000-0000-0000-0000-000000000004', 'driver@example.com')
    on conflict (id) do nothing;

    insert into public.company_memberships (id, company_id, user_id, status, role_in_company) values
      ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'active', 'owner'),
      ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000002', 'active', 'dispatcher'),
      ('10000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000003', 'active', 'owner')
    on conflict (id) do nothing;

    insert into public.drivers (id, user_id, company_id) values
      ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    on conflict (id) do nothing;

    insert into public.vehicles (id, company_id, assigned_driver_id, advertising_state) values
      ('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001', 'none'),
      ('30000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'none')
    on conflict (id) do nothing;
  "
}

validate_runtime_contract() {
  local db="$1"

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000001" "
    select public.set_vehicle_advertising_state(
      '30000000-0000-0000-0000-000000000001',
      null,
      'exchange',
      'owner approval',
      '{\"source\":\"gate-check\"}'::jsonb
    );
  "

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000002" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'partner',
        'impersonation attempt',
        '{}'::jsonb
      );
      raise exception 'expected impersonation rejection';
    exception
      when sqlstate '42501' then
        null;
    end;
    \$\$;
  "

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000003" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        null,
        'partner',
        'cross-company attempt',
        '{}'::jsonb
      );
      raise exception 'expected forbidden error';
    exception
      when sqlstate '42501' then
        null;
    end;
    \$\$;
  "

  run_sql "$db" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'invalid-state',
        'invalid state check',
        '{}'::jsonb
      );
      raise exception 'expected invalid-state rejection';
    exception
      when sqlstate '22023' then
        null;
    end;
    \$\$;
  "

  run_sql "$db" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'partner',
        '',
        '{}'::jsonb
      );
      raise exception 'expected empty reason rejection';
    exception
      when sqlstate '23514' then
        null;
    end;
    \$\$;
  "

  run_sql "$db" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'partner',
        'metadata validation',
        '[]'::jsonb
      );
      raise exception 'expected metadata object rejection';
    exception
      when sqlstate '22023' then
        null;
    end;
    \$\$;
  "

  run_sql "$db" "
    create or replace function public.raise_audit_blocker()
    returns trigger
    language plpgsql
    as \$\$
    begin
      raise exception 'audit write blocked';
    end;
    \$\$;

    drop trigger if exists block_owner_audit_log_insert on public.owner_audit_log;
    create trigger block_owner_audit_log_insert
      before insert on public.owner_audit_log
      for each row
      execute function public.raise_audit_blocker();
  "

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000002" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        null,
        'partner',
        'attempt with blocked audit log',
        '{}'::jsonb
      );
      raise exception 'expected audit failure rollback';
    exception
      when others then
        null;
    end;
    \$\$;
  "

  run_sql "$db" "
    drop trigger if exists block_owner_audit_log_insert on public.owner_audit_log;
  "

  run_sql "$db" "
    do \$\$
    declare
      v_state text;
      v_not_null boolean;
      v_constraint text;
      v_audit_count int;
      v_metadata_logged boolean;
      v_audit_actor uuid;
    begin
      select advertising_state into v_state
      from public.vehicles
      where id = '30000000-0000-0000-0000-000000000001';

      if v_state <> 'exchange' then
        raise exception 'unexpected final state after rollback checks: %', v_state;
      end if;

      select is_nullable = 'NO' into v_not_null
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vehicles'
        and column_name = 'advertising_state';

      if not coalesce(v_not_null, false) then
        raise exception 'advertising_state is not NOT NULL';
      end if;

      select pg_get_constraintdef(oid) into v_constraint
      from pg_constraint
      where conname = 'vehicles_advertising_state_valid';

      if coalesce(v_constraint, '') not like '%none%exchange%partner%' then
        raise exception 'unexpected advertising_state check constraint: %', v_constraint;
      end if;

      select count(*) into v_audit_count
      from public.owner_audit_log
      where target_id = '30000000-0000-0000-0000-000000000001'
        and action_type = 'vehicle_advertising_state_updated';

      if v_audit_count <> 1 then
        raise exception 'expected exactly one persisted audit entry, got %', v_audit_count;
      end if;

      select reason like '%metadata=%' into v_metadata_logged
      from public.owner_audit_log
      where target_id = '30000000-0000-0000-0000-000000000001'
      order by id desc
      limit 1;

      if not coalesce(v_metadata_logged, false) then
        raise exception 'metadata audit suffix missing';
      end if;

      select actor_user_id into v_audit_actor
      from public.owner_audit_log
      where target_id = '30000000-0000-0000-0000-000000000001'
      order by id desc
      limit 1;

      if v_audit_actor <> '00000000-0000-0000-0000-000000000001'::uuid then
        raise exception 'expected audit actor to equal auth.uid(), got %', v_audit_actor;
      end if;
    end;
    \$\$;
  "
}

echo "[1/7] Starting disposable Supabase Postgres"
docker run -d --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p "$PGPORT":5432 supabase/postgres:15.1.0.117 >/dev/null
wait_for_pg

echo "[2/7] Creating disposable databases"
run_sql postgres "create database vehicle_advertising_fresh;"
run_sql postgres "create database vehicle_advertising_existing;"

echo "[3/7] Preparing prerequisites"
setup_prereq_schema vehicle_advertising_fresh
setup_prereq_schema vehicle_advertising_existing

echo "[4/7] Fresh-path migration application"
run_file vehicle_advertising_fresh "$MIGRATION_SQL"
seed_contract_fixtures vehicle_advertising_fresh
validate_runtime_contract vehicle_advertising_fresh

echo "[5/7] Existing-schema upgrade-path migration application"
run_sql vehicle_advertising_existing "
  alter table public.vehicles add column if not exists advertising_state text;
  update public.vehicles set advertising_state = null;
"
run_file vehicle_advertising_existing "$MIGRATION_SQL"
seed_contract_fixtures vehicle_advertising_existing
validate_runtime_contract vehicle_advertising_existing

echo "[6/7] Idempotency re-run"
run_file vehicle_advertising_existing "$MIGRATION_SQL"

echo "[7/7] Contract validation complete"
echo "PASS: vehicle advertising migration verified for fresh + existing disposable databases"
