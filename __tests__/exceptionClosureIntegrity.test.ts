import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MIGRATION = 'supabase/migrations/20260930120000_exception_closure_customer_update_gate.sql';

describe('Exception closure integrity gate', () => {
  it('persists customer communication and verified closure evidence', () => {
    const migration = readRepoFile(MIGRATION);
    for (const field of [
      'customer_updated_at',
      'customer_update_note',
      'closure_verified_at',
      'closure_verified_by',
      'closure_evidence',
    ]) expect(migration).toContain(field);
    expect(migration).toContain('owner_record_platform_case_customer_update');
    expect(migration).toContain('owner_verify_platform_case_closure');
    expect(migration).toContain("'customer_updated'");
    expect(migration).toContain("'closure_verified'");
  });
  it('blocks resolution with an unsatisfied customer update obligation', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("NEW.status IN ('resolved', 'closed')");
    expect(migration).toContain('NEW.customer_update_due_at IS NOT NULL');
    expect(migration).toContain('NEW.customer_updated_at IS NULL');
    expect(migration).toContain('Customer update obligation must be completed before resolution.');
  });

  it('blocks close until verified closure evidence exists', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("NEW.status = 'closed'");
    expect(migration).toContain('NEW.closure_verified_at IS NULL');
    expect(migration).toContain('Verified closure evidence is required before closing a platform case.');
  });

  it('clears stale verification evidence when a case is reopened', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("OLD.status IN ('resolved', 'closed')");
    expect(migration).toContain("NEW.status = 'investigating'");
    expect(migration).toContain('NEW.closure_verified_at := NULL');
    expect(migration).toContain('NEW.customer_updated_at := NULL');
  });
  it('wires the evidence actions through the owner API and detail page', () => {
    const api = readRepoFile('app/api/super-admin/cases/[caseId]/route.ts');
    const page = readRepoFile('app/super-admin/action-centre/[caseId]/page.tsx');
    const list = readRepoFile('app/super-admin/action-centre/page.tsx');
    expect(api).toContain('owner_record_platform_case_customer_update');
    expect(api).toContain('owner_verify_platform_case_closure');
    expect(api).toContain('Deploy Preview is read-only');
    expect(page).toContain('Customer communication');
    expect(page).toContain('Record customer update');
    expect(page).toContain('Verified closure');
    expect(page).toContain('Verify closure evidence');
    expect(list).toContain('Customer update overdue');
    expect(list).toContain('OVERDUE');
  });

  it('auto-assigns reconciled exceptions to the owner running reconciliation', () => {
    const service = readRepoFile('lib/exception-closure/reconcileJobExceptions.ts');
    expect(service).toContain('p_assigned_to_user_id: actorUserId');
  });
});
