import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('company governance audit-target patch', () => {
  const PATCH_MIGRATION =
    'supabase/migrations/20260801160500_safe_company_governance_audit_enrichment.sql';
  const SUPERSEDED_MIGRATION =
    'supabase/migrations/20260801153000_fix_company_governance_audit_target.sql';
  const ORIGINAL_MIGRATION =
    'supabase/migrations/075_super_admin_governance_layer.sql';

  it('patch migration inserts target_type = company into owner_audit_log', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('target_type,');
    expect(migration).toContain("'company'");
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_type[\s\S]*?'company'/);
  });

  it('patch migration inserts target_id = p_target_company_id into owner_audit_log', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('target_id,');
    expect(migration).toContain('p_target_company_id');
    expect(migration).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_id[\s\S]*?p_target_company_id/);
  });

  it('patch migration inserts a deterministic target_name derived from p_target_company_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('target_name,');
    expect(migration).toMatch(/target_name[\s\S]*?format\([\s\S]*?p_target_company_id/);
  });

  it('patch migration preserves target_company_id = p_target_company_id', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('target_company_id,');
    expect(migration).toContain('p_target_company_id');
  });

  it('patch migration preserves SECURITY DEFINER and search_path = public', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public');
  });

  it('patch migration preserves exact function signature and return type', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('public.set_company_status_governance(');
    expect(migration).toMatch(/p_actor_user_id\s+uuid/);
    expect(migration).toMatch(/p_target_company_id\s+uuid/);
    expect(migration).toMatch(/p_action_type\s+text/);
    expect(migration).toMatch(/p_new_status\s+text/);
    expect(migration).toContain('p_reason');
    expect(migration).toContain('RETURNS TABLE (company_id uuid, old_status text, new_status text)');
  });

  it('patch migration revokes PUBLIC and grants only service_role', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM PUBLIC',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) TO service_role',
    );
  });

  it('patch migration wraps the change in a single transaction', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toMatch(/^\s*BEGIN\s*;/m);
    expect(migration).toMatch(/^\s*COMMIT\s*;/m);
  });

  it('patch migration validates owner_audit_log target columns before patching the function', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toMatch(/column_name\s+=\s+'target_type'/);
    expect(migration).toMatch(/column_name\s+=\s+'target_id'/);
    expect(migration).toMatch(/column_name\s+=\s+'target_name'/);
    expect(migration).toMatch(/is_nullable\s+=\s+'NO'/);
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('patch migration preserves company-status transition enforcement and governance trigger context', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).toContain('assert_company_status_transition');
    expect(migration).toContain("set_config('app.company_status_change_context', 'governance_api', true)");
    expect(migration).toContain("UPDATE public.companies SET status = $1::company_status WHERE id = $2");
  });

  it('original migration 075 omitted target_type from the audit insert (documents the bug)', () => {
    const original = readRepoFile(ORIGINAL_MIGRATION);

    const insertBlock = original.slice(
      original.indexOf('INSERT INTO public.owner_audit_log'),
      original.indexOf('RETURN QUERY'),
    );
    expect(insertBlock).not.toContain('target_type');
    expect(insertBlock).not.toContain('target_id');
    expect(insertBlock).not.toContain('target_name');
  });

  it('patch migration does not redefine the other owner_audit_log callers', () => {
    const migration = readRepoFile(PATCH_MIGRATION);

    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.owner_review_compliance_document/,
    );
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.owner_decide_fraud_review_case/,
    );
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.apply_marketplace_governance_action/,
    );
  });

  it('patch migration does not modify table DDL, RLS policies, or driver schema', () => {
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

  it('superseded migration 20260801153000 is marked as must-not-apply', () => {
    const superseded = readRepoFile(SUPERSEDED_MIGRATION);

    expect(superseded).toContain('DO NOT APPLY');
    expect(superseded).toContain('SUPERSEDED BY 20260801160500');
  });

  it('superseded migration 20260801153000 contains no dangerous runtime SQL', () => {
    const superseded = readRepoFile(SUPERSEDED_MIGRATION);

    expect(superseded).not.toMatch(/^CREATE OR REPLACE FUNCTION/im);
    expect(superseded).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(superseded).not.toMatch(/^\s*INSERT\s+INTO\s+public\./im);
    expect(superseded).not.toMatch(/^\s*GRANT\s+/im);
    expect(superseded).not.toMatch(/^\s*REVOKE\s+/im);
    expect(superseded).not.toMatch(/^\s*ALTER\s+TABLE/im);
  });
});
