import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MIGRATION = 'supabase/migrations/20260930153000_platform_case_priority_queue.sql';

describe('Exception Action Centre priority queue', () => {
  it('persists the canonical priority buckets', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("WHEN pc.sla_breached_at IS NOT NULL AND pc.severity = 'P0' THEN 10");
    expect(migration).toContain("WHEN pc.sla_breached_at IS NOT NULL AND pc.severity = 'P1' THEN 20");
    expect(migration).toContain('WHEN pc.assigned_to_user_id IS NULL THEN 30');
    expect(migration).toContain("pc.sla_due_at <= p_now + interval '30 minutes' THEN 40");
    expect(migration).toContain('ELSE 50');
  });

  it('refreshes priority inside the canonical reconciliation loop', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('service_refresh_platform_case_priority');
    expect(migration).toContain("'priority_updated',v_priority_updated");
  });

  it('orders the Action Centre API by persisted priority before SLA due time', () => {
    const route = readRepoFile('app/api/super-admin/cases/route.ts');
    expect(route).toContain("priority_bucket, priority_updated_at");
    expect(route).toContain(".order('priority_bucket', { ascending: true })");
    expect(route).toContain(".order('sla_due_at', { ascending: true, nullsFirst: false })");
  });

  it('refreshes priority after manual reconciliation as well', () => {
    const service = readRepoFile('lib/exception-closure/reconcileJobExceptions.ts');
    expect(service).toContain("service_refresh_platform_case_priority");
  });
});
