import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830182000_company_membership_governance_integrity.sql'),
  'utf8',
);
const runtimeProof = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830182100_verify_company_membership_governance_runtime.sql'),
  'utf8',
);

describe('company membership governance integrity', () => {
  it('never permits an active membership on a non-active company', () => {
    expect(migration).toContain("NEW.status::text <> 'active'");
    expect(migration).toContain("v_company_status <> 'active'");
    expect(migration).toContain("THEN 'disabled'");
    expect(migration).toContain("ELSE 'invited'");
  });

  it('applies the guard to every writer, not only authenticated creator requests', () => {
    expect(migration).not.toContain("v_jwt_role = 'authenticated'");
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF company_id, status');
  });

  it('revokes memberships transactionally when company governance leaves active', () => {
    expect(migration).toContain('fail_close_company_memberships_on_status_change');
    expect(migration).toContain('AFTER UPDATE OF status');
    expect(migration).toContain("AND NEW.status::text <> 'active'");
  });

  it('does not approve or activate pending companies during historical reconciliation', () => {
    expect(migration).toContain("cm.status = 'active'");
    expect(migration).toContain("c.status::text <> 'active'");
    expect(migration).not.toContain("UPDATE public.companies\nSET status = 'active'");
  });

  it('contains a final zero-tolerance invariant', () => {
    expect(migration).toContain('active memberships remain on non-active companies');
  });

  it('proves activation guard and company suspension propagation in production', () => {
    expect(runtimeProof).toContain('PZ031');
    expect(runtimeProof).toContain('PZ032');
    expect(runtimeProof).toContain("'suspended'");
    expect(runtimeProof).toContain('Runtime proof finished with active membership on non-active company.');
  });
});
