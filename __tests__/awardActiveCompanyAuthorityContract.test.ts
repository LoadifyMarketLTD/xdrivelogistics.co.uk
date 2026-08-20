import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260820113000_award_active_company_authority_closure.sql'),
  'utf8',
);

describe('commercial award active-company authority contract', () => {
  it('preserves the approved award implementation behind a private base function', () => {
    expect(source).toContain('RENAME TO accept_job_bid_atomic_award_authority_base_v1');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.accept_job_bid_atomic_award_authority_base_v1(uuid, uuid)');
    expect(source).toContain('FROM PUBLIC, anon, authenticated, service_role;');
    expect(source).toContain('RETURN public.accept_job_bid_atomic_award_authority_base_v1(');
  });

  it('requires active owner/admin/dispatcher membership and an active job-owning company', () => {
    expect(source).toContain("COALESCE(cm.status::text, '') = 'active'");
    expect(source).toContain("COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin', 'dispatcher')");
    expect(source).toContain("COALESCE(c.status::text, '') = 'active'");
    expect(source).toContain('FOR SHARE OF cm, c;');
  });

  it('keeps the public RPC service-role-only', () => {
    expect(source).toContain('REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid)');
    expect(source).toContain('FROM PUBLIC, anon, authenticated;');
    expect(source).toContain('GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid)');
    expect(source).toContain('TO service_role;');
  });
});
