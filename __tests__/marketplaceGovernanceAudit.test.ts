import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('marketplace governance audit-target patch', () => {
  const PATCH_MIGRATION =
    'supabase/migrations/20260801091000_fix_owner_audit_log_target_type.sql';
  const ORIGINAL_MIGRATION =
    'supabase/migrations/078_marketplace_governance_atomic_action.sql';

  it('patch migration inserts target_type = job into owner_audit_log', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_type,");
    expect(migration).toContain("'job'");
    // The INSERT value list must assign the literal 'job' to target_type
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_type[\s\S]*?'job'/);
  });

  it('patch migration inserts target_id = p_job_id into owner_audit_log', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_id,");
    expect(migration).toContain("p_job_id");
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_id[\s\S]*?p_job_id/);
  });

  it('patch migration inserts a deterministic target_name derived from p_job_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_name,");
    // target_name must be computed from p_job_id, not a hard-coded constant
    expect(migration).toMatch(/target_name[\s\S]*?format\([\s\S]*?p_job_id/);
  });

  it('patch migration inserts target_company_id = v_company_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("target_company_id,");
    expect(migration).toContain("v_company_id");
  });

  it('patch migration preserves SECURITY DEFINER', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('SECURITY DEFINER');
  });

  it('patch migration preserves search_path = public', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('SET search_path = public');
  });

  it('patch migration preserves exact function signature and return type', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain(
      'public.apply_marketplace_governance_action(',
    );
    expect(migration).toContain('p_actor_user_id uuid');
    expect(migration).toContain('p_job_id uuid');
    expect(migration).toContain('p_action text');
    expect(migration).toContain('p_reason text DEFAULT NULL');
    expect(migration).toContain('RETURNS TABLE');
    expect(migration).toContain('exchange_visibility text');
  });

  it('patch migration revokes PUBLIC and grants only service_role', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM PUBLIC',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) TO service_role',
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
    expect(migration).toContain("column_name = 'target_id'");
    expect(migration).toContain("column_name = 'target_name'");
    // Must raise, not silently skip, if required columns are missing
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('patch migration does not modify owner_audit_log.target_type default (no DEFAULT added)', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    // The only ALTER permitted is DROP DEFAULT + SET NOT NULL confirmation
    expect(migration).toContain('ALTER COLUMN target_type DROP DEFAULT');
    expect(migration).not.toMatch(/ALTER COLUMN target_type SET DEFAULT/);
  });

  it('original migration 078 omitted target_type from the audit insert (documents the bug)', () => {
    const original = readRepoFile(ORIGINAL_MIGRATION);

    // Confirm the bug: the original INSERT column list lacks target_type
    const insertBlock = original.slice(
      original.indexOf('INSERT INTO public.owner_audit_log'),
      original.indexOf('RETURN QUERY'),
    );
    expect(insertBlock).not.toContain('target_type');
    expect(insertBlock).not.toContain('target_id');
  });

  it('patch migration does not touch set_company_status_governance or owner_review_compliance_document', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).not.toContain('set_company_status_governance');
    expect(migration).not.toContain('owner_review_compliance_document');
    expect(migration).not.toContain('owner_decide_fraud_review_case');
  });

  it('patch migration does not modify any table DDL, RLS policy or driver schema', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    // No table creation or RLS changes are allowed in this narrow patch
    expect(migration).not.toMatch(/CREATE TABLE/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
    expect(migration).not.toMatch(/ALTER TABLE.*ADD COLUMN (?!owner_audit_log)/i);
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).not.toMatch(/DROP POLICY/i);
  });

  it('patch migration issues a PostgREST schema-cache reload after commit', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });
});

describe('marketplace governance audit-target patch — SQL atomicity test reference', () => {
  it('records the executable SQL atomicity test path for disposable-environment verification', () => {
    // The executable SQL test lives at:
    //   supabase/tests/marketplace_governance_atomicity.sql
    // It must be run on a disposable/staging database only.
    // Assertions it verifies:
    //   1. A successful governance action commits the job update and inserts exactly one audit row.
    //   2. audit row: target_type = 'job'
    //   3. audit row: target_id = the job UUID passed as p_job_id
    //   4. audit row: actor_user_id, action_type, old_status, new_status, reason, target_company_id correct
    //   5. The job update is rolled back when the audit INSERT fails (atomicity).
    const testPath = readRepoFile(
      'supabase/tests/marketplace_governance_atomicity.sql',
    );

    expect(testPath).toContain('apply_marketplace_governance_action');
    expect(testPath).toContain("target_type = 'job'");
    expect(testPath).toContain('target_id');
    expect(testPath).toContain('ROLLBACK');
  });
});
