import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql'
);
const migration = readFileSync(migrationPath, 'utf8');

test.describe('canonical company membership authorization contract', () => {
  test('uses company_memberships as the only membership source', () => {
    expect(migration).toContain('FROM public.company_memberships');
    expect(migration).not.toMatch(/FROM\s+public\.company_members\b/);
    expect(migration).not.toMatch(/JOIN\s+public\.company_members\b/);
  });

  test('requires exact active membership and active company status', () => {
    expect(migration).toContain("cm.status = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).not.toContain("status <> 'suspended'");
  });

  test('does not add synchronization, backfill or legacy table mutations', () => {
    expect(migration).not.toMatch(/CREATE\s+TRIGGER/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.company_members\b/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.company_members\b/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.company_members\b/i);
  });

  test('keeps privileged access fail-closed', () => {
    expect(migration).toContain("IN ('owner', 'admin')");
    expect(migration).toContain('COALESCE(');
    expect(migration).toContain('false');
  });
});
