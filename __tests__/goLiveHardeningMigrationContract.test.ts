import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const OWNER_AUDIT_INDEX_MIGRATION =
  'supabase/migrations/20260904214000_add_owner_audit_log_target_company_index.sql';
const LEGACY_RPC_RESTRICTION_MIGRATION =
  'supabase/migrations/20260904222500_restrict_legacy_governance_security_definer_rpcs.sql';

const LEGACY_GOVERNANCE_FUNCTIONS = [
  'approve_company',
  'reject_company',
  'submit_company_for_review',
  'create_driver_invite',
] as const;

describe('PR #500 go-live hardening migration contracts', () => {
  it('adds the owner audit company index without mutating business data', () => {
    const migration = readRepoFile(OWNER_AUDIT_INDEX_MIGRATION);

    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_owner_audit_log_target_company_id');
    expect(migration).toContain('ON public.owner_audit_log (target_company_id)');
    expect(migration).toContain("SET LOCAL lock_timeout = '10s'");
    expect(migration).toContain("SET LOCAL statement_timeout = '120s'");
    expect(migration).not.toContain('DELETE FROM public.owner_audit_log');
    expect(migration).not.toContain('UPDATE public.owner_audit_log');
  });

  it('restricts only the known legacy SECURITY DEFINER governance RPC names', () => {
    const migration = readRepoFile(LEGACY_RPC_RESTRICTION_MIGRATION);

    expect(migration).toContain("n.nspname = 'public'");
    expect(migration).toContain('AND p.prosecdef');

    for (const functionName of LEGACY_GOVERNANCE_FUNCTIONS) {
      expect(migration).toContain(`'${functionName}'`);
    }

    expect(migration).toContain(
      "'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated'",
    );
    expect(migration).toContain("'GRANT EXECUTE ON FUNCTION %s TO service_role'");
    expect(migration).not.toContain('DROP FUNCTION');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION');
    expect(migration).not.toContain('TO authenticated');
  });
});
