import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260730102000_driver_schema_convergence_for_mobile.sql',
    import.meta.url,
  ),
  'utf-8',
);

describe('PR #301 driver schema convergence', () => {
  it('adds the mobile driver columns idempotently', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS driver_type text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS can_commercial_bid boolean');
  });

  it('normalises only the two canonical driver identities', () => {
    expect(migration).toContain("driver_type NOT IN ('owner_driver', 'company_driver')");
    expect(migration).toContain("CHECK (driver_type IN ('owner_driver', 'company_driver'))");
  });

  it('preserves an explicit commercial-bidding revocation', () => {
    expect(migration).toContain('WHERE can_commercial_bid IS NULL');
    expect(migration).not.toContain('WHERE can_commercial_bid = false');
  });

  it('makes both columns non-null and reloads the PostgREST schema cache', () => {
    expect(migration).toContain('ALTER COLUMN driver_type SET NOT NULL');
    expect(migration).toContain('ALTER COLUMN can_commercial_bid SET NOT NULL');
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
