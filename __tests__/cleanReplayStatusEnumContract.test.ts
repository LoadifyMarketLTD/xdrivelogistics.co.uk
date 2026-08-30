import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260830174500_vehicle_driver_company_integrity.sql'),
  'utf8',
);

describe('clean replay canonical status enum contract', () => {
  it('reconstructs the hosted Driver and Vehicle status enum before enum-dependent integrity work', () => {
    expect(migration).toContain(
      "CREATE TYPE public.status_enum AS ENUM (''active'', ''inactive'', ''suspended'')",
    );
    expect(migration).toContain("ARRAY['active', 'inactive', 'suspended']::text[]");
    expect(migration).toContain('ALTER TABLE public.drivers ALTER COLUMN status TYPE public.status_enum');
    expect(migration).toContain('ALTER TABLE public.vehicles ALTER COLUMN status TYPE public.status_enum');
    expect(migration.indexOf("to_regtype('public.status_enum')")).toBeLessThan(
      migration.indexOf("status = 'inactive'::public.status_enum"),
    );
  });

  it('fails closed instead of coercing unknown replay data or an incompatible existing type', () => {
    expect(migration).toContain('public.status_enum exists but is not an enum type.');
    expect(migration).toContain('public.status_enum labels differ from the hosted canonical contract');
    expect(migration).toContain(
      'Unsupported driver status values prevent canonical status_enum reconstruction',
    );
    expect(migration).toContain(
      'Unsupported vehicle status values prevent canonical status_enum reconstruction',
    );
  });

  it('preserves the hosted default for both converted columns', () => {
    expect(migration).toContain(
      "ALTER TABLE public.drivers ALTER COLUMN status SET DEFAULT ''active''::public.status_enum",
    );
    expect(migration).toContain(
      "ALTER TABLE public.vehicles ALTER COLUMN status SET DEFAULT ''active''::public.status_enum",
    );
  });
});
