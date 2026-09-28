import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_reconcile_approved_customer_onboarding_context.sql'));

if (!migrationName) throw new Error('Approved customer onboarding repair migration is missing.');

const migration = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');

describe('approved customer onboarding context repair', () => {
  it('targets only historical approved customers without company context', () => {
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("account_type = 'customer_shipper'");
    expect(migration).toContain('company_id IS NULL');
  });

  it('fails closed when pre-existing company context is ambiguous', () => {
    expect(migration).toContain('v_existing_company_count <> 0 OR v_existing_membership_count <> 0');
    expect(migration).toContain('ambiguous pre-existing company context');
  });

  it('rebuilds company, active membership, profile context and application binding', () => {
    expect(migration).toContain('INSERT INTO public.companies');
    expect(migration).toContain('INSERT INTO public.company_memberships');
    expect(migration).toContain("'admin'");
    expect(migration).toContain("SET company_id = v_company_id");
    expect(migration).toContain("role = 'customer'");
    expect(migration).toContain('UPDATE public.onboarding_applications');
  });

  it('verifies the approved-customer postcondition before commit', () => {
    expect(migration).toContain('Approved customer onboarding company-context invariant is still violated.');
    expect(migration).toContain('cm.company_id = a.company_id');
    expect(migration).toContain('p.company_id = a.company_id');
  });
});
