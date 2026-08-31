import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readMigration = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), `supabase/migrations/${name}`), 'utf8');

const initialSchema = readMigration('001_initial_schema.sql');
const profileStatus = readMigration('027_add_profiles_status_column.sql');
const availabilitySplit = readMigration('048_split_driver_availability_from_employment_status.sql');
const exchangeRlsRepair = readMigration('091_fix_driver_exchange_rls.sql');
const vehicleReadiness = readMigration('20260819154500_reconcile_vehicle_readiness_physical_contract.sql');
const integrity = readMigration('20260830174500_vehicle_driver_company_integrity.sql');
const identityRuntime = readMigration('20260830175600_verify_canonical_driver_identity_runtime.sql');

describe('clean replay canonical status enum contracts', () => {
  it('reconstructs the hosted Driver lifecycle type before Driver RLS policies bind to status', () => {
    expect(initialSchema).toContain(
      "CREATE TYPE public.status_enum AS ENUM ('active', 'inactive', 'suspended')",
    );
    expect(initialSchema).toContain("status public.status_enum DEFAULT 'active'");
  });

  it('reconstructs the hosted profile lifecycle enum before profile policies and identity triggers bind to status', () => {
    expect(profileStatus).toContain(
      "CREATE TYPE public.user_status AS ENUM (''pending'', ''active'', ''blocked'')",
    );
    expect(profileStatus).toContain(
      "ADD COLUMN status public.user_status NOT NULL DEFAULT 'active'::public.user_status",
    );
    expect(profileStatus).toContain("ARRAY['pending', 'active', 'blocked']::text[]");
    expect(profileStatus).toContain(
      'Unsupported profile status values prevent canonical user_status reconstruction',
    );
  });

  it('keeps the historical availability split compatible with both text drift and the canonical enum', () => {
    expect(availabilitySplit).toContain("status::text IN ('available', 'busy', 'offline')");
    expect(availabilitySplit).toContain('THEN status::text');
    expect(availabilitySplit).toContain("SET status = 'active'");
  });

  it('keeps legacy exchange status checks textual without widening canonical enums', () => {
    expect(exchangeRlsRepair).toContain(
      "d.status::text NOT IN ('suspended', 'inactive', 'rejected')",
    );
    expect(exchangeRlsRepair).toContain(
      "p.status::text NOT IN ('blocked', 'suspended', 'inactive', 'pending')",
    );
    expect(exchangeRlsRepair).not.toContain(
      "d.status NOT IN ('suspended', 'inactive', 'rejected')",
    );
    expect(exchangeRlsRepair).not.toContain(
      "p.status NOT IN ('blocked', 'suspended', 'inactive', 'pending')",
    );
  });

  it('materializes the hosted Vehicle physical contract before later integrity reconciliation', () => {
    expect(vehicleReadiness).toContain("to_regtype('public.status_enum')");
    expect(vehicleReadiness).toContain(
      "ADD COLUMN status public.status_enum DEFAULT 'active'::public.status_enum",
    );
    expect(vehicleReadiness).toContain('ADD COLUMN notes text');
    expect(vehicleReadiness).toContain('ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()');
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

  it('binds company membership policies to text from the initial schema and finalizes the hosted vocabulary before governance', () => {
    expect(initialSchema).toContain(
      "CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended')",
    );
    expect(initialSchema).toContain("status text DEFAULT 'invited'");
    expect(initialSchema).not.toContain("status public.membership_status DEFAULT 'invited'");
    expect(identityRuntime).toContain(
      "company_memberships.status must already be text before governance hardening",
    );
    expect(identityRuntime).not.toContain('ALTER COLUMN status TYPE text');
    expect(identityRuntime).toContain("cm.status NOT IN ('active', 'invited', 'disabled')");
    expect(identityRuntime).toContain("ALTER COLUMN status SET DEFAULT 'active'::text");
    expect(identityRuntime).toContain(
      "CHECK (status IN ('active', 'invited', 'disabled')) NOT VALID",
    );
    expect(identityRuntime).toContain(
      'Unsupported membership status values prevent canonical text finalization',
    );
  });
});
