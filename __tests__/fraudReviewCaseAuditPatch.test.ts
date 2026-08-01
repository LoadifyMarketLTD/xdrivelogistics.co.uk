import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('fraud review case audit-target patch archival', () => {
  const PATCH_MIGRATION =
    'supabase/migrations/20260801163000_p0_fix_fraud_review_case_audit_target_type.sql';
  const HISTORICAL_PATCH =
    'docs/ops/20260801163000_p0_fix_fraud_review_case_audit_target_type.historical.sql';
  const SUPERSEDED_MIGRATION =
    'supabase/migrations/20260801130000_fix_fraud_review_case_audit_target.sql';
  const ORIGINAL_BACKFILL =
    'supabase/migrations/20260730100000_owner_decide_fraud_review_case_atomicity_backfill.sql';

  it('automatic-chain migration is an executable notice-only no-op', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('archived as NOT APPLICABLE');
    expect(migration).toContain('intentionally performs no schema or data changes');
    expect(migration).toMatch(/^\s*BEGIN\s*;/m);
    expect(migration).toMatch(/^\s*COMMIT\s*;/m);
    expect(migration).toMatch(/RAISE NOTICE/i);

    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(migration).not.toMatch(/^\s*ALTER\s+TABLE/im);
    expect(migration).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(migration).not.toMatch(/^\s*INSERT\s+INTO\s+public\./im);
    expect(migration).not.toMatch(/^\s*DELETE\s+FROM\s+public\./im);
    expect(migration).not.toMatch(/^\s*GRANT\s+/im);
    expect(migration).not.toMatch(/^\s*REVOKE\s+/im);
    expect(migration).not.toMatch(/NOTIFY\s+pgrst/i);
  });

  it('historical SQL preserves the candidate function patch and grants', () => {
    const historical = readRepoFile(HISTORICAL_PATCH);

    expect(historical).toContain('CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(');
    expect(historical).toContain('SECURITY DEFINER');
    expect(historical).toContain('SET search_path = public, pg_temp');
    expect(historical).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_type[\s\S]*?'fraud_case'/);
    expect(historical).toContain('REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC');
    expect(historical).toContain('GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role');
    expect(historical).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it('historical SQL preserves preflight checks for fraud_review_cases compatibility', () => {
    const historical = readRepoFile(HISTORICAL_PATCH);

    expect(historical).toContain("table_name   = 'fraud_review_cases'");
    expect(historical).toContain('public.fraud_review_cases does not exist as an updatable base table');
  });

  it('original backfill migration 20260730100000 omits target_type and target_id (documents the bug)', () => {
    const original = readRepoFile(ORIGINAL_BACKFILL);

    const insertBlock = original.slice(
      original.indexOf('INSERT INTO public.owner_audit_log'),
      original.indexOf('RETURN QUERY SELECT v_case.id'),
    );
    expect(insertBlock).not.toContain('target_type');
    expect(insertBlock).not.toContain('target_id');
    expect(insertBlock).not.toContain('target_name');
  });

  it('superseded migration 20260801130000 is marked as must-not-apply', () => {
    const superseded = readRepoFile(SUPERSEDED_MIGRATION);

    expect(superseded).toContain('DO NOT APPLY');
    expect(superseded).toContain('SUPERSEDED BY 20260801163000');
  });

  it('superseded migration 20260801130000 contains no dangerous runtime SQL', () => {
    const superseded = readRepoFile(SUPERSEDED_MIGRATION);

    expect(superseded).not.toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(superseded).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(superseded).not.toMatch(/^\s*INSERT\s+INTO\s+public\./im);
    expect(superseded).not.toMatch(/^\s*GRANT\s+/im);
    expect(superseded).not.toMatch(/^\s*REVOKE\s+/im);
    expect(superseded).not.toMatch(/^\s*ALTER\s+TABLE/im);
  });
});
