import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readMigration = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), `supabase/migrations/${name}`), 'utf8');

const initialSchema = readMigration('001_initial_schema.sql');
const availabilitySplit = readMigration('048_split_driver_availability_from_employment_status.sql');
const exchangeRlsRepair = readMigration('091_fix_driver_exchange_rls.sql');
const vehicleReadiness = readMigration('20260819154500_reconcile_vehicle_readiness_physical_contract.sql');
const integrity = readMigration('20260830174500_vehicle_driver_company_integrity.sql');

describe('clean replay canonical status enum contract', () => {
  it('reconstructs the hosted Driver lifecycle type before Driver RLS policies bind to status', () => {
    expect(initialSchema).toContain(
      "CREATE TYPE public.status_enum AS ENUM ('active', 'inactive', 'suspended')",
    );
    expect(initialSchema).toContain("status public.status_enum DEFAULT 'active'");
  });

  it('keeps the historical availability split compatible with both text drift and the canonical enum', () => {
    expect(availabilitySplit).toContain("status::text IN ('available', 'busy', 'offline')");
    expect(availabilitySplit).toContain('THEN status::text');
    expect(availabilitySplit).toContain("SET status = 'active'");
  });

  it('keeps legacy rejected-status exchange checks textual without widening status_enum', () => {
    expect(exchangeRlsRepair).toContain(
      "d.status::text NOT IN ('suspended', 'inactive', 'rejected')",
    );
    expect(exchangeRlsRepair).not.toContain(
      "d.status NOT IN ('suspended', 'inactive', 'rejected')",
    );
  });

  it('materializes Vehicle lifecycle status directly with the hosted canonical type', () => {
    expect(vehicleReadiness).toContain("to_regtype('public.status_enum')");
    expect(vehicleReadiness).toContain(
      "ADD COLUMN status public.status_enum DEFAULT 'active'::public.status_enum",
    );
    expect(vehicleReadiness).not.toContain("ADD COLUMN status text DEFAULT 'active'");
  });

  it('keeps the late integrity migration fail-closed around the exact hosted enum contract', () => {
    expect(integrity).toContain("ARRAY['active', 'inactive', 'suspended']::text[]");
    expect(integrity).toContain('public.status_enum exists but is not an enum type.');
    expect(integrity).toContain('public.status_enum labels differ from the hosted canonical contract');
    expect(integrity).toContain(
      'Unsupported driver status values prevent canonical status_enum reconstruction',
    );
    expect(integrity).toContain(
      'Unsupported vehicle status values prevent canonical status_enum reconstruction',
    );
  });
});
