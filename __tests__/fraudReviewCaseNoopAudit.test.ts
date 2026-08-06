import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('fraud review repeated-action audit guarantee', () => {
  const MIGRATION =
    'supabase/migrations/20260806223000_audit_fraud_noop_actions.sql';
  const SQL_REGRESSION =
    'supabase/tests/fraud_review_case_noop_audit.sql';

  it('records an audit row before returning a successful no-state-change result', () => {
    const migration = readRepoFile(MIGRATION);
    const branchStart = migration.indexOf(
      "IF v_case.status = v_next_status",
    );
    const branchEnd = migration.indexOf(
      "UPDATE public.fraud_review_cases",
      branchStart,
    );
    const noStateChangeBranch = migration.slice(branchStart, branchEnd);

    expect(branchStart).toBeGreaterThanOrEqual(0);
    expect(branchEnd).toBeGreaterThan(branchStart);
    expect(noStateChangeBranch).toContain('INSERT INTO public.owner_audit_log');
    expect(noStateChangeBranch).toContain("'fraud_case'");
    expect(noStateChangeBranch).toContain('p_case_id');
    expect(noStateChangeBranch).toContain("format('fraud_case_%s', p_action)");
    expect(noStateChangeBranch).toContain('v_case.status');
    expect(noStateChangeBranch).toContain('p_reason');
    expect(noStateChangeBranch).toContain("'no_state_change', true");

    const auditInsert = noStateChangeBranch.indexOf(
      'INSERT INTO public.owner_audit_log',
    );
    const successReturn = noStateChangeBranch.indexOf(
      'RETURN QUERY SELECT v_case.id, v_case.status, v_case.status',
    );
    expect(auditInsert).toBeGreaterThanOrEqual(0);
    expect(successReturn).toBeGreaterThan(auditInsert);
  });

  it('preserves atomic function security and service-role-only execution', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(',
    );
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM authenticated',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM anon',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role',
    );
    expect(migration).toMatch(/^\s*BEGIN\s*;/m);
    expect(migration).toMatch(/^\s*COMMIT\s*;/m);
  });

  it('keeps the existing business mutation and canonical audit path', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('UPDATE public.fraud_review_cases');
    expect(migration).toContain('UPDATE public.onboarding_applications');
    expect(migration).toContain("SET status = 'blocked'");
    expect(migration).toContain("format('fraud_case_%s', p_action)");
    expect(migration).toContain("'subject_user_id', v_case.subject_user_id");
    expect(migration).toContain(
      "'onboarding_application_id', v_case.onboarding_application_id",
    );
  });

  it('includes an executable rollback regression for the repeated action', () => {
    const sql = readRepoFile(SQL_REGRESSION);

    expect(sql).toContain('owner_decide_fraud_review_case');
    expect(sql).toContain("'investigate'");
    expect(sql).toContain("target_company_id IS NULL");
    expect(sql).toContain("action_type = 'fraud_case_investigate'");
    expect(sql).toContain("old_status = 'investigating'");
    expect(sql).toContain("new_status = 'investigating'");
    expect(sql).toContain("metadata->>'no_state_change' = 'true'");
    expect(sql).toContain('v_audit_after = v_audit_before + 1');
    expect(sql).toContain('ROLLBACK;');
  });
});
