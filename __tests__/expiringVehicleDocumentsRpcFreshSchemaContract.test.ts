import fs from 'node:fs';
import path from 'node:path';

describe('expiring vehicle documents RPC fresh-schema bootstrap', () => {
  const bootstrap = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927010353_bootstrap_expiring_vehicle_documents_rpc.sql'),
    'utf8',
  );
  const hardening = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927010354_harden_workspace_rpc_exposure.sql'),
    'utf8',
  );

  it('creates the hosted RPC before the hardening migration revokes direct execution', () => {
    expect('20260927010353' < '20260927010354').toBe(true);
    expect(bootstrap).toContain('CREATE OR REPLACE FUNCTION public.get_expiring_vehicle_documents');
    expect(bootstrap).toContain('SECURITY DEFINER');
    expect(bootstrap).toContain('SET search_path = public, pg_temp');
    expect(hardening).toContain('REVOKE ALL ON FUNCTION public.get_expiring_vehicle_documents(integer)');
  });

  it('reproduces the hosted fail-closed execution surface', () => {
    expect(bootstrap).toContain('FROM PUBLIC, anon, authenticated');
    expect(bootstrap).toContain('TO service_role');
    expect(bootstrap).not.toContain('TO authenticated');
  });
});