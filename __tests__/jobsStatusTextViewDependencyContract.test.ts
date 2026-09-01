import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260819145000_bridge_jobs_status_enum_to_text_view_dependencies.sql'),
  'utf8',
);

describe('jobs.status enum-to-text dependency bridge', () => {
  it('is a no-op for the proven live text contract', () => {
    expect(source).toContain("IF v_status_data_type = 'text' THEN");
    expect(source).toContain('RETURN;');
  });

  it('preserves the two repo-owned fresh view contracts without cascade drops', () => {
    expect(source).toContain("to_regclass('public.dashboard_stats')");
    expect(source).toContain("to_regclass('public.job_bids_with_job_owner')");
    expect(source).toContain('CREATE VIEW public.dashboard_stats');
    expect(source).toContain('CREATE VIEW public.job_bids_with_job_owner');
    expect(source).toContain('WITH (security_invoker = true)');
    expect(source).toContain('GRANT SELECT ON public.job_bids_with_job_owner TO authenticated');
    expect(source).toContain('GRANT SELECT ON public.job_bids_with_job_owner TO service_role');
    expect(source).not.toMatch(/DROP\s+VIEW[^;]*\s+CASCADE/iu);
  });

  it('drops the migration-079 column-specific trigger before converting status', () => {
    const dropTrigger = source.indexOf('DROP TRIGGER IF EXISTS trg_validate_job_status_transition ON public.jobs');
    const alterType = source.indexOf('ALTER COLUMN status TYPE text USING status::text');

    expect(dropTrigger).toBeGreaterThan(-1);
    expect(alterType).toBeGreaterThan(dropTrigger);
    expect(source).not.toContain('CREATE TRIGGER trg_validate_job_status_transition');
  });

  it('rebuilds the migration-124 partial index with the proven live text predicate', () => {
    const dropIndex = source.indexOf('DROP INDEX public.jobs_destination_priority_pickup_idx');
    const alterType = source.indexOf('ALTER COLUMN status TYPE text USING status::text');
    const createIndex = source.indexOf('CREATE INDEX jobs_destination_priority_pickup_idx');

    expect(dropIndex).toBeGreaterThan(-1);
    expect(alterType).toBeGreaterThan(dropIndex);
    expect(createIndex).toBeGreaterThan(alterType);
    expect(source).toContain("WHERE status = 'posted'::text");
  });

  it('fails closed on any other persisted job_status expression before ALTER TYPE', () => {
    expect(source).toContain("pg_get_indexdef(i.indexrelid) LIKE '%::job_status%'");
    expect(source).toContain('Unreconciled jobs.status enum-backed indexes remain');
    expect(source).toContain("pg_get_constraintdef(con.oid, true) LIKE '%::job_status%'");
    expect(source).toContain('Unreconciled jobs.status enum-backed constraints remain');
    expect(source).toContain("pg_get_expr(pol.polqual, pol.polrelid), '') LIKE '%::job_status%'");
    expect(source).toContain('Unreconciled jobs.status enum-backed policies remain');
  });

  it('converts only the historical job_status enum and fails closed on unknown view dependencies', () => {
    expect(source).toContain("v_status_udt_name IS DISTINCT FROM 'job_status'");
    expect(source).toContain('ALTER COLUMN status TYPE text USING status::text');
    expect(source).toContain('Unreconciled jobs.status dependent views remain');
    expect(source).toContain("a.attname = 'status'");
  });

  it('does not change finance or workspace permissions', () => {
    expect(source).not.toContain('INSERT INTO public.invoices');
    expect(source).not.toContain('UPDATE public.invoices');
    expect(source).not.toContain('accept_job_bid_atomic');
    expect(source).not.toContain('CREATE POLICY');
    expect(source).not.toContain('roleCapabilities');
  });
});
