import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('broker customer book contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/broker/customers/page.tsx'), 'utf8');
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261009063500_company_customers.sql'), 'utf8');

  it('provides a real Add Customer workflow backed by company_customers', () => {
    expect(page).toContain('+ Add Customer');
    expect(page).toContain(".from('company_customers')");
    expect(page).toContain('company_id: data.companyId');
    expect(page).toContain('Post load for customer');
  });

  it('keeps the customer book company-scoped and protected by RLS', () => {
    expect(migration).toContain('create table if not exists public.company_customers');
    expect(migration).toContain('alter table public.company_customers enable row level security');
    expect(migration).toContain('public.is_company_member(company_id)');
  });
});
