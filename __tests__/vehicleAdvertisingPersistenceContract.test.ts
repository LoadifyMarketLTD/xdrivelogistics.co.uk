import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('vehicle advertising persistence contract', () => {
  it('keeps canonical state values and tenant-safe guards in migration SQL', () => {
    const sql = read('supabase/migrations/20260802073000_vehicle_advertising_contract.sql');

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS advertising_state text");
    expect(sql).toContain("CHECK (advertising_state IN ('none', 'exchange', 'partner'))");
    expect(sql).toContain('ALTER COLUMN advertising_state SET NOT NULL');
    expect(sql).toContain('v_authenticated_actor_user_id uuid := auth.uid();');
    expect(sql).toContain("p_actor_user_id IS DISTINCT FROM v_authenticated_actor_user_id");
    expect(sql).toContain("RAISE EXCEPTION 'Forbidden — actor_user_id must match auth.uid().'");
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain("AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')");
    expect(sql).toContain("RAISE EXCEPTION 'Forbidden — you cannot change this vehicle advertising state.'");
    expect(sql).toContain('INSERT INTO public.owner_audit_log');
    expect(sql).toContain('old_status');
    expect(sql).toContain('new_status');
    expect(sql).toContain("|| ' | metadata='");
  });

  it('remains idempotent and migration-chain safe for existing databases', () => {
    const sql = read('supabase/migrations/20260802073000_vehicle_advertising_contract.sql');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS');
    expect(sql).toContain('IF NOT EXISTS (');
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
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
