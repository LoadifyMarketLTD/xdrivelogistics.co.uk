import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260819154500_reconcile_vehicle_readiness_physical_contract.sql',
  ),
  'utf8',
);

describe('vehicle readiness physical contract reconciliation', () => {
  it('materialises only the live-proven readiness columns when clean replay omitted them', () => {
    expect(migration).toContain("table_name = 'vehicles'");
    expect(migration).toContain("column_name = 'status'");
    expect(migration).toContain("ADD COLUMN status public.status_enum DEFAULT 'active'::public.status_enum");
    expect(migration).toContain("column_name = 'is_available'");
    expect(migration).toContain('ADD COLUMN is_available boolean DEFAULT true');
  });

  it('does not rewrite vehicle data or change unrelated authority boundaries', () => {
    expect(migration).not.toContain('UPDATE public.vehicles');
    expect(migration).not.toContain('DELETE FROM public.vehicles');
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).not.toContain('DROP POLICY');
    expect(migration).not.toContain('accept_job_bid_atomic');
    expect(migration).not.toContain('INSERT INTO public.invoices');
    expect(migration).not.toContain('roleCapabilities');
  });
});
