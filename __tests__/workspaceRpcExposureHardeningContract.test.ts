import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260927010354_harden_workspace_rpc_exposure.sql'),
  'utf8',
);

describe('workspace RPC exposure hardening contract', () => {
  it('pins notification classifier search_path', () => {
    expect(migration).toContain('ALTER FUNCTION public.fn_notification_event_class(text)');
    expect(migration).toContain('SET search_path = pg_catalog, public');
  });

  it('removes direct authenticated execution from internal compliance helpers', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.driver_has_valid_cpc(uuid)');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_expiring_vehicle_documents(integer)');
    expect(migration).toContain("has_function_privilege('authenticated', 'public.driver_has_valid_cpc(uuid)'::regprocedure, 'EXECUTE')");
    expect(migration).toContain("has_function_privilege('authenticated', 'public.get_expiring_vehicle_documents(integer)'::regprocedure, 'EXECUTE')");
  });

  it('keeps server-side CPC evaluation while hardening legacy Driver go-online', () => {
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.driver_has_valid_cpc(uuid)');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.driver_go_online()');
    expect(migration).toContain("COALESCE(d.status::text, '') = 'active'");
    expect(migration).toContain('COALESCE(d.app_access, false) = true');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.driver_go_online() TO authenticated, service_role');
    expect(migration).not.toContain('GRANT EXECUTE ON FUNCTION public.get_expiring_vehicle_documents(integer)');
  });
});
