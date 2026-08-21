import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('vehicle advertising persistence contract', () => {
  it('keeps canonical state values and only exposes the auth-bound public RPC in the first migration', () => {
    const sql = read('supabase/migrations/20260802073000_vehicle_advertising_contract.sql');

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS advertising_state text");
    expect(sql).toContain("CHECK (advertising_state IN ('none', 'exchange', 'partner'))");
    expect(sql).toContain('ALTER COLUMN advertising_state SET NOT NULL');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.set_vehicle_advertising_state(');
    expect(sql).toContain("v_actor_user_id uuid := auth.uid();");
    expect(sql).toContain("RAISE EXCEPTION 'Forbidden — auth.uid() is required for this RPC.'");
    expect(sql).not.toContain('p_actor_user_id');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain("AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')");
    expect(sql).toContain("RAISE EXCEPTION 'Forbidden — you cannot change this vehicle advertising state.'");
    expect(sql).toContain('INSERT INTO public.owner_audit_log');
    expect(sql).toContain('old_status');
    expect(sql).toContain('new_status');
    expect(sql).toContain("|| ' | metadata='");
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb) TO authenticated;');
    expect(sql).not.toContain('uuid, uuid, text, text, jsonb');
    expect(sql).not.toContain('TO service_role;');
  });

  it('keeps the later auth RPC migration as cleanup-only upgrade compatibility', () => {
    const sql = read('supabase/migrations/20260802113000_vehicle_advertising_auth_rpc_contract.sql');

    expect(sql).toContain('DROP FUNCTION IF EXISTS public.set_vehicle_advertising_state(uuid, uuid, text, text, jsonb);');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.set_vehicle_advertising_state(');
    expect(sql).toContain('p_vehicle_id uuid,');
    expect(sql).toContain('p_state text,');
    expect(sql).toContain('p_reason text,');
    expect(sql).toContain("v_actor_user_id uuid := auth.uid();");
    expect(sql).toContain("RAISE EXCEPTION 'Forbidden — auth.uid() is required for this RPC.'");
    expect(sql).not.toContain('p_actor_user_id');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb) TO authenticated;');
    expect(sql).not.toContain('TO service_role;');
  });

  it('remains idempotent and migration-chain safe for fresh and existing databases', () => {
    const legacySql = read('supabase/migrations/20260802073000_vehicle_advertising_contract.sql');
    const authSql = read('supabase/migrations/20260802113000_vehicle_advertising_auth_rpc_contract.sql');

    expect(legacySql).toContain('ADD COLUMN IF NOT EXISTS');
    expect(legacySql).toContain('IF NOT EXISTS (');
    expect(legacySql).toContain('BEGIN;');
    expect(legacySql).toContain('COMMIT;');
    expect(legacySql).toContain("NOTIFY pgrst, 'reload schema'");
    expect(authSql).toContain('BEGIN;');
    expect(authSql).toContain('DROP FUNCTION IF EXISTS public.set_vehicle_advertising_state(uuid, uuid, text, text, jsonb);');
    expect(authSql).toContain('COMMIT;');
    expect(authSql).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('exercises the PostgREST RPC contract in the disposable validator', () => {
    const validator = read('scripts/validate_vehicle_advertising_contract.sh');

    expect(validator).toContain('postgrest/postgrest:latest');
    expect(validator).toContain('/rpc/set_vehicle_advertising_state');
    expect(validator).toContain('validate_first_migration_contract');
    expect(validator).toContain("to_regprocedure('public.set_vehicle_advertising_state(uuid, text, text, jsonb)')");
    expect(validator).toContain("to_regprocedure('public.set_vehicle_advertising_state(uuid, uuid, text, text, jsonb)')");
    expect(validator).toContain('legacy 5-argument RPC must not exist after first migration');
    expect(validator).toContain('Expected legacy 5-argument PostgREST payload to be unavailable');
    expect(validator).toContain('docker exec "$POSTGRES_CONTAINER_NAME"');
    expect(validator).toContain('pg_isready -U "$PGUSER" -d postgres');
    expect(validator).toContain('docker logs --tail 200 "$POSTGRES_CONTAINER_NAME"');
    expect(validator).toContain('for _ in {1..180}');
  });

  it('forces API clients to provide an explicit reason and canonical state', () => {
    const route = read('app/api/admin/vehicles/[id]/advertising/route.ts');

    expect(route).toContain("state: z.enum(['none', 'exchange', 'partner'])");
    expect(route).toContain('reason: z.string().trim().min(1).max(500)');
    expect(route).not.toContain('p_actor_user_id');
    expect(route).toContain("error.code === '42501' ? 403");
  });

  it('reloads persisted advertising_state in the vehicles workspace after successful save', () => {
    const page = read('app/admin/vehicles/page.tsx');

    expect(page).toContain('selectColumns =');
    expect(page).toContain('advertising_state');
    expect(page).toContain('const committedState = payload.newState ?? nextState;');
    expect(page).toContain('advertising_state: committedState');
    expect(page).toContain('loadVehicles();');
  });
});
