import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test.describe('individual driver approval and mobile contract', () => {
  test('approval migration keeps individual drivers outside company provisioning', () => {
    const migration = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations/20260725003000_allow_individual_driver_approval_without_company.sql'),
      'utf8'
    );

    expect(migration).toContain("v_app.account_type = 'individual_driver'");
    expect(migration).toContain('company_id = NULL');
    expect(migration).toContain('app_access = true');
    expect(migration).toContain("v_app.account_type <> 'individual_driver' AND v_company_id IS NULL");
    expect(migration).toContain("CASE WHEN v_app.account_type = 'individual_driver' THEN NULL ELSE v_company_id END");
  });

  test('mobile driver auth no longer hard-fails when company_id is null', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'app/api/driver/mobile/_lib.ts'),
      'utf8'
    );

    expect(source).toContain('companyId: string | null;');
    expect(source).not.toContain('Driver is not linked to an active company workspace.');
  });
});
