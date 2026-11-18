import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('canonical fresh-DB fix: owner_decide_fraud_review_case audit target', () => {
  const MIGRATION =
    'supabase/migrations/20260801210000_canonical_fraud_review_audit_target_fresh_db.sql';
  const WORKFLOW =
    '.github/workflows/validate-identity-compliance-foundation.yml';

  it('migration inserts target_type = fraud_case into owner_audit_log', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('target_type,');
    expect(migration).toContain("'fraud_case'");
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_type[\s\S]*?'fraud_case'/);
  });

  it('migration inserts target_id = p_case_id into owner_audit_log', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('target_id,');
    expect(migration).toContain('p_case_id');
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_id[\s\S]*?p_case_id/);
  });

  it('migration inserts a deterministic target_name derived from p_case_id', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('target_name,');
    expect(migration).toMatch(/target_name[\s\S]*?format\([\s\S]*?p_case_id/);
  });

  it('migration preserves SECURITY DEFINER and search_path', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
  });

  it('migration is conditional: skips gracefully when fraud_review_cases is absent', () => {
    const migration = readRepoFile(MIGRATION);

    // Must check for the table before applying DDL
    expect(migration).toContain("table_name   = 'fraud_review_cases'");
    // Must emit a NOTICE (not EXCEPTION) when skipping
    expect(migration).toContain('fraud_review_cases does not exist (production environment)');
    expect(migration).toMatch(/RAISE NOTICE[\s\S]*?fraud_review_cases does not exist/);
    // The table guard must use RETURN (not RAISE EXCEPTION) to skip gracefully
    expect(migration).not.toMatch(
      /fraud_review_cases[\s\S]{0,50}RAISE EXCEPTION[\s\S]{0,200}production/,
    );
  });

  it('migration uses EXECUTE to defer compile-time reference to fraud_review_cases', () => {
    const migration = readRepoFile(MIGRATION);

    // The CREATE OR REPLACE must be inside an EXECUTE call so it only compiles
    // at runtime (after the table-existence check passes)
    expect(migration).toMatch(/EXECUTE\s+\$FUNC\$/);
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(');
  });

  it('migration has REVOKE and GRANT for service_role', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role',
    );
  });

  it('migration has no column DEFAULT on owner_audit_log.target_type', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).not.toMatch(/ALTER COLUMN target_type SET DEFAULT/i);
    expect(migration).not.toMatch(/DEFAULT\s+'platform'/i);
  });

  it('migration has no trigger that auto-populates target_type', () => {
    const migration = readRepoFile(MIGRATION);

    expect(migration).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/i);
  });

  it('migration is included in the CI validation workflow after MIGRATION_OWNER_AUDIT_TARGET_COLUMNS', () => {
    const workflow = readRepoFile(WORKFLOW);

    expect(workflow).toContain('20260801210000_canonical_fraud_review_audit_target_fresh_db.sql');
    expect(workflow).toContain('MIGRATION_FRESH_DB_FRAUD_FIX');

    // Must run after the target columns are created (080000)
    const auditColumnsPos = workflow.indexOf(
      'psql -v ON_ERROR_STOP=1 -f "${MIGRATION_OWNER_AUDIT_TARGET_COLUMNS}"',
    );
    const freshDbFixPos = workflow.indexOf(
      'psql -v ON_ERROR_STOP=1 -f "${MIGRATION_FRESH_DB_FRAUD_FIX}"',
    );
    expect(auditColumnsPos).toBeGreaterThan(-1);
    expect(freshDbFixPos).toBeGreaterThan(-1);
    expect(auditColumnsPos).toBeLessThan(freshDbFixPos);
  });

  it('migration is included in the CI workflow trigger paths', () => {
    const workflow = readRepoFile(WORKFLOW);

    expect(workflow).toContain(
      '"supabase/migrations/20260801210000_canonical_fraud_review_audit_target_fresh_db.sql"',
    );
  });
});
