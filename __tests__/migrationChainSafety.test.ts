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

describe('archived fraud review audit-target migration', () => {
  it('keeps the automatic migration file as no-op and archives the candidate patch externally', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260801163000_p0_fix_fraud_review_case_audit_target_type.sql',
    );
    const archived = readRepoFile(
      'docs/ops/20260801163000_p0_fix_fraud_review_case_audit_target_type.historical.sql',
    );

    expect(migration).toContain('archived as NOT APPLICABLE');
    expect(migration).toContain('intentionally performs no schema or data changes');
    expect(migration).toMatch(/RAISE NOTICE/i);

    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(migration).not.toMatch(/^\s*ALTER\s+TABLE/im);
    expect(migration).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(migration).not.toMatch(/^\s*INSERT\s+INTO\s+public\./im);
    expect(migration).not.toMatch(/^\s*DELETE\s+FROM\s+public\./im);
    expect(migration).not.toMatch(/^\s*GRANT\s+/im);
    expect(migration).not.toMatch(/^\s*REVOKE\s+/im);
    expect(migration).not.toMatch(/NOTIFY\s+pgrst/i);

    expect(archived).toContain('CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(');
    expect(archived).toMatch(/INSERT INTO public\.owner_audit_log[\s\S]*?target_type[\s\S]*?'fraud_case'/);
    expect(archived).toContain('GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role');
  });
});
