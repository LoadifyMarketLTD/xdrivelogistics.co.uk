import fs from 'node:fs';
import path from 'node:path';

describe('cancellation approval custody guard', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261117142000_guard_cancellation_approval_until_goods_resolved.sql'),
    'utf8',
  );

  it('keeps cancellation approval fail-closed while return or redirect is unresolved', () => {
    expect(migration).toContain('decide_awarded_job_cancellation_atomic');
    expect(migration).toContain("IN ('return', 'redirect')");
    expect(migration).toContain("js.status <> 'completed'");
    expect(migration).toContain("handover->'returnInstruction'->>'resolutionRequired'");
    expect(migration).toContain('Goods remain in custody or an authorised return/redirect is unresolved');
  });

  it('checks physical resolution before mutating the cancellation request or parent job', () => {
    const guard = migration.indexOf("IF v_decision = 'approved' THEN");
    const requestMutation = migration.indexOf('UPDATE public.job_cancellation_requests');
    const jobMutation = migration.indexOf('UPDATE public.jobs');
    expect(guard).toBeGreaterThan(-1);
    expect(requestMutation).toBeGreaterThan(guard);
    expect(jobMutation).toBeGreaterThan(requestMutation);
  });

  it('keeps job and load cancellation atomic after the guard passes', () => {
    expect(migration).toContain("SET status = 'cancelled'");
    expect(migration).toContain("current_status = 'cancelled'");
    expect(migration).toContain('UPDATE public.loads');
    expect(migration).toContain("SET status = 'cancelled'");
  });

  it('does not grant the cancellation decision RPC directly to normal clients', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
  });
});
