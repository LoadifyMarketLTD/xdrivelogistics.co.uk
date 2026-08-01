import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('owner_audit_log canonical target columns migration', () => {
  it('creates and normalizes the canonical target columns without a masking default', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260801080000_canonical_owner_audit_log_target_columns.sql',
    );

    expect(migration).toContain('ADD COLUMN target_type text');
    expect(migration).toContain('ADD COLUMN target_id uuid');
    expect(migration).toContain('ADD COLUMN target_name text');
    expect(migration).toContain('ALTER COLUMN target_type DROP DEFAULT');
    expect(migration).toContain('ALTER COLUMN target_type SET NOT NULL');
    expect(migration).not.toMatch(/ALTER COLUMN target_type SET DEFAULT/i);
  });

  it('is executed before the dependent owner_audit_log function migrations in validation order', () => {
    const workflow = readRepoFile('.github/workflows/validate-identity-compliance-foundation.yml');

    expect(workflow).toContain('20260801080000_canonical_owner_audit_log_target_columns.sql');
    expect(workflow.indexOf('MIGRATION_OWNER_AUDIT_TARGET_COLUMNS')).toBeLessThan(
      workflow.indexOf('MIGRATION_FIX_OWNER_REVIEW'),
    );
    expect(workflow.indexOf('psql -v ON_ERROR_STOP=1 -f "${MIGRATION_OWNER_AUDIT_TARGET_COLUMNS}"')).toBeLessThan(
      workflow.indexOf('psql -v ON_ERROR_STOP=1 -f "${MIGRATION_FIX_OWNER_REVIEW}"'),
    );
  });
});

describe('retired driver commercial catch-up migration', () => {
  it('keeps the automatic migration file as a real no-op and preserves the historical SQL outside supabase/migrations', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql',
    );
    const archived = readRepoFile(
      'docs/ops/20260801000000_p0_driver_commercial_columns_catchup.historical.sql',
    );

    expect(migration).toContain('intentionally performs no schema or data changes');
    expect(migration).not.toMatch(/ALTER TABLE public\.drivers/i);
    expect(migration).not.toMatch(/UPDATE public\.drivers/i);
    expect(migration).not.toMatch(/CREATE POLICY job_bids_exchange_insert/i);
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.review_onboarding_application_atomic/i);
    expect(migration).not.toMatch(/INSERT INTO public\.notification_events/i);
    expect(migration).not.toMatch(/NOTIFY pgrst/i);

    expect(archived).toContain('ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS driver_type text;');
    expect(archived).toContain('CREATE POLICY job_bids_exchange_insert');
    expect(archived).toContain('CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic');
    expect(archived).toContain('INSERT INTO public.notification_events');
  });
});
