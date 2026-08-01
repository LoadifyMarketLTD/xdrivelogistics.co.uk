import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('fraud review case audit-target patch', () => {
  const PATCH_MIGRATION =
    'supabase/migrations/20260801163000_p0_fix_fraud_review_case_audit_target_type.sql';
  const SUPERSEDED_MIGRATION =
    'supabase/migrations/20260801130000_fix_fraud_review_case_audit_target.sql';
  const ORIGINAL_BACKFILL =
    'supabase/migrations/20260730100000_owner_decide_fraud_review_case_atomicity_backfill.sql';

  it('patch migration inserts target_type = fraud_case into owner_audit_log', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_type,");
    expect(migration).toContain("'fraud_case'");
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_type[\s\S]*?'fraud_case'/);
  });

  it('patch migration inserts target_id = p_case_id into owner_audit_log', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_id,");
    expect(migration).toContain("p_case_id");
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_id[\s\S]*?p_case_id/);
  });

  it('patch migration inserts a deterministic target_name derived from p_case_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_name,");
    expect(migration).toMatch(/target_name[\s\S]*?format\([\s\S]*?p_case_id/);
  });

  it('patch migration inserts target_company_id = v_case.subject_company_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_company_id,");
    expect(migration).toContain("v_case.subject_company_id");
  });

  it('patch migration preserves metadata jsonb field with fraud_case_id, subject_user_id, onboarding_application_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("metadata");
    expect(migration).toContain("'fraud_case_id'");
    expect(migration).toContain("'subject_user_id'");
    expect(migration).toContain("'onboarding_application_id'");
  });

  it('patch migration preserves SECURITY DEFINER', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('SECURITY DEFINER');
  });

  it('patch migration preserves search_path = public, pg_temp', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('SET search_path = public, pg_temp');
  });

  it('patch migration preserves exact function signature and return type', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('public.owner_decide_fraud_review_case(');
    expect(migration).toContain('p_actor_user_id uuid');
    expect(migration).toMatch(/p_case_id\s+uuid/);
    expect(migration).toMatch(/p_action\s+text/);
    expect(migration).toMatch(/p_reason\s+text/);
    expect(migration).toContain('RETURNS TABLE (case_id uuid, old_status text, new_status text)');
  });

  it('patch migration revokes PUBLIC and grants only service_role', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role',
    );
  });

  it('patch migration wraps the change in a single transaction', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toMatch(/^\s*BEGIN\s*;/m);
    expect(migration).toMatch(/^\s*COMMIT\s*;/m);
  });

  it('patch migration validates owner_audit_log target columns before patching the function', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("column_name  = 'target_type'");
    expect(migration).toContain("column_name  = 'target_type'");
    expect(migration).toContain("column_name  = 'target_id'");
    expect(migration).toContain("column_name  = 'target_name'");
    expect(migration).toContain("is_nullable  = 'NO'");
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('patch migration preserves all fraud business logic guards', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("p_action NOT IN ('investigate', 'clear', 'confirm', 'dismiss')");
    expect(migration).toContain('Fraud review case not found.');
    expect(migration).toContain('Fraud confirmation requires a canonical subject_user_id.');
    expect(migration).toContain('Fraud review case is already finalised');
    expect(migration).toContain('Fraud case is already confirmed but subject profile is not blocked.');
    expect(migration).toContain('Fraud confirmation expected exactly one canonical profile update');
  });

  it('patch migration preserves profile blocking and onboarding-application side effects', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("SET status = 'blocked'");
    expect(migration).toMatch(/risk_status\s*=\s*'confirmed_fraud'/);
    expect(migration).toMatch(/risk_status\s*=\s*'clear'/);
    expect(migration).toContain('onboarding_applications');
  });

  it('patch migration does not define or replace the other three owner_audit_log callers', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    // The other three functions may be mentioned in comments but must NOT have a
    // CREATE OR REPLACE FUNCTION block for them.
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.set_company_status_governance/,
    );
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.owner_review_compliance_document/,
    );
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.apply_marketplace_governance_action/,
    );
  });

  it('patch migration does not modify table DDL, RLS policies or driver schema', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).not.toMatch(/CREATE TABLE/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).not.toMatch(/DROP POLICY/i);
    expect(migration).not.toMatch(/ALTER TABLE public\.drivers/i);
  });

  it('patch migration issues a PostgREST schema-cache reload after commit', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
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

  it('patch migration includes the BLOCKED/conditional production guidance comment', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('DO NOT APPLY until the two open evidence gaps below are resolved.');
    expect(migration).toContain("to_regprocedure(");
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
