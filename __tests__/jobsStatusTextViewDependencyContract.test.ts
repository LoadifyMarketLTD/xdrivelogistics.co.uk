import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260819145000_bridge_jobs_status_enum_to_text_view_dependencies.sql'),
  'utf8',
);

describe('jobs.status enum-to-text view dependency bridge', () => {
  it('is a no-op for the proven live text contract', () => {
    expect(source).toContain("IF v_status_data_type = 'text' THEN");
    expect(source).toContain('RETURN;');
  });

  it('preserves the two repo-owned fresh view contracts without cascade drops', () => {
    expect(source).toContain("to_regclass('public.dashboard_stats')");
    expect(source).toContain("to_regclass('public.job_bids_with_job_owner')");
    expect(source).toContain('CREATE VIEW public.dashboard_stats AS');
    expect(source).toContain('CREATE VIEW public.job_bids_with_job_owner');
    expect(source).toContain('WITH (security_invoker = true)');
    expect(source).toContain('GRANT SELECT ON public.job_bids_with_job_owner TO authenticated');
    expect(source).toContain('GRANT SELECT ON public.job_bids_with_job_owner TO service_role');
    expect(source).not.toMatch(/DROP\s+VIEW[^;]*\s+CASCADE/iu);
  });

  it('converts only the historical job_status enum and fails closed on unknown view dependencies', () => {
    expect(source).toContain("v_status_udt_name IS DISTINCT FROM 'job_status'");
    expect(source).toContain('ALTER COLUMN status TYPE text USING status::text');
    expect(source).toContain('Unreconciled jobs.status dependent views remain');
    expect(source).toContain("a.attname = 'status'");
  });

  it('does not change lifecycle, finance or workspace permissions', () => {
    expect(source).not.toContain('INSERT INTO public.invoices');
    expect(source).not.toContain('UPDATE public.invoices');
    expect(source).not.toContain('accept_job_bid_atomic');
    expect(source).not.toContain('CREATE POLICY');
    expect(source).not.toContain('roleCapabilities');
  });
});
