#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEGACY_MIGRATION_SQL="$REPO_ROOT/supabase/migrations/20260802073000_vehicle_advertising_contract.sql"
AUTH_RPC_MIGRATION_SQL="$REPO_ROOT/supabase/migrations/20260802113000_vehicle_advertising_auth_rpc_contract.sql"
NETWORK_NAME="xdrive-vehicle-advertising-net-$RANDOM"
POSTGRES_CONTAINER_NAME="xdrive-vehicle-advertising-contract-$RANDOM"
POSTGREST_CONTAINER_NAME="xdrive-vehicle-advertising-postgrest-$RANDOM"
PGPORT="${PGPORT:-55438}"
POSTGREST_PORT="${POSTGREST_PORT:-55439}"
POSTGREST_URL="http://127.0.0.1:${POSTGREST_PORT}"
JWT_SECRET="vehicle-advertising-contract-secret-2026"
PGHOST=127.0.0.1
PGUSER=postgres
PGPASSWORD=postgres
export PGPASSWORD

cleanup() {
  docker rm -f "$POSTGREST_CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm -f "$POSTGRES_CONTAINER_NAME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_pg() {
  # Readiness belongs to the disposable container itself. Checking with a host
  # psql binary made Windows/WSL networking failures look like database
  # contract failures and discarded the only useful diagnostics during cleanup.
  for _ in {1..180}; do
    if docker exec "$POSTGRES_CONTAINER_NAME" \
      pg_isready -U "$PGUSER" -d postgres >/dev/null 2>&1; then
      return 0
    fi

    if [[ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CONTAINER_NAME" 2>/dev/null || true)" != 'true' ]]; then
      break
    fi

    sleep 1
  done

  echo "Disposable Postgres did not become ready" >&2
  docker inspect "$POSTGRES_CONTAINER_NAME" \
    --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}}' \
    >&2 || true
  docker logs --tail 200 "$POSTGRES_CONTAINER_NAME" >&2 || true
  return 1
}

wait_for_http() {
  local url="$1"
  local status_code

  for _ in {1..60}; do
    status_code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$status_code" == '200' ]]; then
      return 0
    fi
    sleep 1
  done

  echo "HTTP service at $url did not become ready in time" >&2
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

make_jwt() {
  local user_id="$1"
  local role="$2"

  python - "$user_id" "$role" "$JWT_SECRET" <<'PY'
import base64
import hashlib
import hmac
import json
import sys

sub, role, secret = sys.argv[1:4]

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
payload = b64url(json.dumps({"sub": sub, "role": role}, separators=(",", ":")).encode())
signature = b64url(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
print(f"{header}.{payload}.{signature}")
PY
}

rpc_call() {
  local token="$1"
  local payload="$2"
  local response_file="$3"
  local auth_header

  auth_header="$(printf '%s %s %s' 'Authorization:' 'Bearer' "$token")"

  curl -sS -o "$response_file" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -H "$auth_header" \
    -d "$payload" \
    "$POSTGREST_URL/rpc/set_vehicle_advertising_state"
}

start_postgrest() {
  local db="$1"
  local db_uri
  local db_uri_scheme db_uri_credentials db_uri_host

  db_uri_scheme='postgresql://'
  db_uri_credentials="$PGUSER"
  db_uri_credentials+=":$PGPASSWORD"
  db_uri_host="host.docker.internal:$PGPORT/$db"
  db_uri="${db_uri_scheme}${db_uri_credentials}@${db_uri_host}"
  docker rm -f "$POSTGREST_CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$POSTGREST_CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    --add-host=host.docker.internal:host-gateway \
    -p "$POSTGREST_PORT":3000 \
    -e PGRST_DB_URI="$db_uri" \
    -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_DB_SCHEMAS=public \
    -e PGRST_JWT_SECRET="$JWT_SECRET" \
    postgrest/postgrest:latest >/dev/null

  if ! wait_for_http "$POSTGREST_URL/"; then
    docker logs "$POSTGREST_CONTAINER_NAME" || true
    return 1
  fi
}

setup_prereq_schema() {
  local db="$1"
  run_sql "$db" "create schema if not exists auth;"
  run_sql "$db" "
    do \$\$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
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
    select set_config('request.jwt.claims', json_build_object('sub', '$user_id', 'role', 'authenticated')::text, true);
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

validate_sql_runtime_contract() {
  local db="$1"

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000001" "
    select public.set_vehicle_advertising_state(
      '30000000-0000-0000-0000-000000000001',
      'exchange',
      'owner approval',
      '{\"source\":\"sql-contract\"}'::jsonb
    );
  "

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000002" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'::uuid,
        'partner',
        'legacy impersonation signature should be unavailable',
        '{}'::jsonb
      );
      raise exception 'expected legacy signature to be unavailable';
    exception
      when sqlstate '42883' then
        null;
    end;
    \$\$;
  "

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000003" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
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

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000002" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
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

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000002" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
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

  run_as_authenticated "$db" "00000000-0000-0000-0000-000000000002" "
    do \$\$
    begin
      perform public.set_vehicle_advertising_state(
        '30000000-0000-0000-0000-000000000001',
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

  run_sql "$db" "drop trigger if exists block_owner_audit_log_insert on public.owner_audit_log;"

  run_sql "$db" "
    do \$\$
    declare
      v_state text;
      v_not_null boolean;
      v_constraint text;
      v_audit_count int;
      v_metadata_logged boolean;
      v_audit_actor uuid;
      v_public_signature regprocedure;
      v_legacy_signature regprocedure;
      v_authenticated_grant boolean;
      v_service_grant boolean;
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

      select to_regprocedure('public.set_vehicle_advertising_state(uuid, text, text, jsonb)') into v_public_signature;
      select to_regprocedure('public.set_vehicle_advertising_state(uuid, uuid, text, text, jsonb)') into v_legacy_signature;

      if v_public_signature is null then
        raise exception 'expected auth-bound 4-argument RPC signature';
      end if;

      if v_legacy_signature is not null then
        raise exception 'legacy 5-argument RPC signature still exists';
      end if;

      select has_function_privilege('authenticated', 'public.set_vehicle_advertising_state(uuid, text, text, jsonb)', 'EXECUTE')
      into v_authenticated_grant;
      select has_function_privilege('service_role', 'public.set_vehicle_advertising_state(uuid, text, text, jsonb)', 'EXECUTE')
      into v_service_grant;

      if not coalesce(v_authenticated_grant, false) then
        raise exception 'authenticated role is missing execute grant on 4-argument RPC';
      end if;

      if coalesce(v_service_grant, false) then
        raise exception 'service_role should not retain execute grant on public 4-argument RPC';
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

validate_first_migration_contract() {
  local db="$1"

  run_sql "$db" "
    do \$\$
    declare
      v_public_signature regprocedure;
      v_legacy_signature regprocedure;
      v_authenticated_grant boolean;
      v_service_grant boolean;
    begin
      select to_regprocedure('public.set_vehicle_advertising_state(uuid, text, text, jsonb)') into v_public_signature;
      select to_regprocedure('public.set_vehicle_advertising_state(uuid, uuid, text, text, jsonb)') into v_legacy_signature;

      if v_public_signature is null then
        raise exception 'expected first migration to create auth-bound 4-argument RPC';
      end if;

      if v_legacy_signature is not null then
        raise exception 'legacy 5-argument RPC must not exist after first migration';
      end if;

      select has_function_privilege('authenticated', 'public.set_vehicle_advertising_state(uuid, text, text, jsonb)', 'EXECUTE')
      into v_authenticated_grant;
      select has_function_privilege('service_role', 'public.set_vehicle_advertising_state(uuid, text, text, jsonb)', 'EXECUTE')
      into v_service_grant;

      if not coalesce(v_authenticated_grant, false) then
        raise exception 'authenticated role is missing execute grant after first migration';
      end if;

      if coalesce(v_service_grant, false) then
        raise exception 'service_role must not have execute grant after first migration';
      end if;
    end;
    \$\$;
  "
}

validate_postgrest_contract() {
  local db="$1"
  local owner_token dispatcher_token outsider_token body_file status_code
  body_file="$(mktemp /tmp/vehicle-advertising-postgrest-XXXXXX.json)"
  trap 'rm -f "$body_file"' RETURN

  owner_token="$(make_jwt '00000000-0000-0000-0000-000000000001' 'authenticated')"
  dispatcher_token="$(make_jwt '00000000-0000-0000-0000-000000000002' 'authenticated')"
  outsider_token="$(make_jwt '00000000-0000-0000-0000-000000000003' 'authenticated')"

  start_postgrest "$db"

  status_code="$(rpc_call "$owner_token" '{"p_vehicle_id":"30000000-0000-0000-0000-000000000001","p_state":"exchange","p_reason":"owner via postgrest","p_metadata":{"source":"postgrest-contract"}}' "$body_file")"
  if [[ "$status_code" != '200' ]] || ! grep -q '"new_state":"exchange"' "$body_file"; then
    echo "Expected PostgREST 4-argument RPC success for owner, got HTTP $status_code" >&2
    cat "$body_file" >&2
    return 1
  fi

  status_code="$(rpc_call "$dispatcher_token" '{"p_vehicle_id":"30000000-0000-0000-0000-000000000001","p_actor_user_id":"00000000-0000-0000-0000-000000000001","p_state":"partner","p_reason":"legacy impersonation payload","p_metadata":{}}' "$body_file")"
  if [[ "$status_code" == '200' ]] || ! grep -Eq 'set_vehicle_advertising_state|function' "$body_file"; then
    echo "Expected legacy 5-argument PostgREST payload to be unavailable, got HTTP $status_code" >&2
    cat "$body_file" >&2
    return 1
  fi

  status_code="$(rpc_call "$outsider_token" '{"p_vehicle_id":"30000000-0000-0000-0000-000000000001","p_state":"partner","p_reason":"cross-company via postgrest","p_metadata":{}}' "$body_file")"
  if [[ "$status_code" != '403' ]]; then
    echo "Expected cross-company PostgREST rejection, got HTTP $status_code" >&2
    cat "$body_file" >&2
    return 1
  fi

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

  status_code="$(rpc_call "$dispatcher_token" '{"p_vehicle_id":"30000000-0000-0000-0000-000000000001","p_state":"partner","p_reason":"blocked audit via postgrest","p_metadata":{}}' "$body_file")"
  if [[ "$status_code" != '400' && "$status_code" != '500' ]]; then
    echo "Expected audit failure rollback through PostgREST, got HTTP $status_code" >&2
    cat "$body_file" >&2
    return 1
  fi

  run_sql "$db" "drop trigger if exists block_owner_audit_log_insert on public.owner_audit_log;"

  run_sql "$db" "
    do \$\$
    declare
      v_state text;
      v_audit_actor uuid;
      v_audit_count int;
    begin
      select advertising_state into v_state
      from public.vehicles
      where id = '30000000-0000-0000-0000-000000000001';

      if v_state <> 'exchange' then
        raise exception 'postgrest rollback did not preserve exchange state: %', v_state;
      end if;

      select actor_user_id into v_audit_actor
      from public.owner_audit_log
      where target_id = '30000000-0000-0000-0000-000000000001'
      order by id desc
      limit 1;

      if v_audit_actor <> '00000000-0000-0000-0000-000000000001'::uuid then
        raise exception 'expected PostgREST audit actor to equal JWT sub, got %', v_audit_actor;
      end if;

      select count(*) into v_audit_count
      from public.owner_audit_log
      where target_id = '30000000-0000-0000-0000-000000000001'
        and action_type = 'vehicle_advertising_state_updated';

      if v_audit_count <> 1 then
        raise exception 'expected exactly one persisted PostgREST audit entry, got %', v_audit_count;
      end if;
    end;
    \$\$;
  "
}

echo "[1/9] Starting disposable Supabase Postgres"
docker network create "$NETWORK_NAME" >/dev/null
docker run -d --name "$POSTGRES_CONTAINER_NAME" --network "$NETWORK_NAME" --network-alias db -e POSTGRES_PASSWORD=postgres -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=postgres -p "$PGPORT":5432 supabase/postgres:15.1.0.117 >/dev/null
wait_for_pg

echo "[2/9] Creating disposable databases"
run_sql postgres "create database vehicle_advertising_fresh;"
run_sql postgres "create database vehicle_advertising_existing;"

echo "[3/9] Preparing prerequisites"
setup_prereq_schema vehicle_advertising_fresh
setup_prereq_schema vehicle_advertising_existing

echo "[4/9] Fresh-path first migration safety"
run_file vehicle_advertising_fresh "$LEGACY_MIGRATION_SQL"
validate_first_migration_contract vehicle_advertising_fresh

echo "[5/9] Fresh-path auth RPC cleanup compatibility"
run_file vehicle_advertising_fresh "$AUTH_RPC_MIGRATION_SQL"
seed_contract_fixtures vehicle_advertising_fresh
validate_sql_runtime_contract vehicle_advertising_fresh

echo "[6/9] Existing-schema legacy path"
run_sql vehicle_advertising_existing "
  alter table public.vehicles add column if not exists advertising_state text;
  update public.vehicles set advertising_state = null;
"
run_file vehicle_advertising_existing "$LEGACY_MIGRATION_SQL"
validate_first_migration_contract vehicle_advertising_existing
seed_contract_fixtures vehicle_advertising_existing

echo "[7/9] Auth-bound upgrade migration with PostgREST schema reload"
run_file vehicle_advertising_existing "$AUTH_RPC_MIGRATION_SQL"
validate_postgrest_contract vehicle_advertising_existing

echo "[8/9] Idempotency re-run"
run_file vehicle_advertising_existing "$AUTH_RPC_MIGRATION_SQL"

echo "[9/9] Contract validation complete"
echo "PASS: vehicle advertising migrations verified for fresh + existing disposable databases, including PostgREST RPC resolution"
