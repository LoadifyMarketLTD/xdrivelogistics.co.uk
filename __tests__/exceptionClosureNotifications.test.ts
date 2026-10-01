import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MIGRATION = 'supabase/migrations/20260930141500_exception_closure_company_notifications.sql';
const EDGE = 'supabase/functions/notify-operational-event/index.ts';

describe('Exception Closure Engine company notifications', () => {
  it('routes active company cases to authorised membership roles with stable idempotency', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('service_enqueue_exception_case_notifications');
    expect(migration).toContain("pc.source='exception_closure_engine'");
    expect(migration).toContain("cm.role_in_company");
    expect(migration).toContain("'owner','admin','finance'");
    expect(migration).toContain("'owner','admin','fleet_manager','dispatcher'");
    expect(migration).toContain("'exception-case:' || r.case_id::text");
    expect(migration).toContain('ON CONFLICT (idempotency_key)');
  });

  it('separates operational, POD and finance notification classes', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain("'exception_operational_alert'");
    expect(migration).toContain("'exception_pod_alert'");
    expect(migration).toContain("'exception_finance_alert'");
  });

  it('wires notification routing into the canonical minute reconciliation wrapper', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('v_notifications := public.service_enqueue_exception_case_notifications(p_now)');
    expect(migration).toContain("'notifications_enqueued',v_notifications");
  });

  it('handles exception alerts in the private notification worker', () => {
    const edge = readRepoFile(EDGE);
    expect(edge).toContain('handleExceptionCaseAlert');
    expect(edge).toContain("case 'exception_operational_alert'");
    expect(edge).toContain("case 'exception_pod_alert'");
    expect(edge).toContain("case 'exception_finance_alert'");
    expect(edge).toContain("'/admin/incidents'");
    expect(edge).toContain("'/admin/pod'");
    expect(edge).toContain("'/admin/finance'");
  });

  it('maps finance exception alerts to finance notification preferences', () => {
    const edge = readRepoFile(EDGE);
    expect(edge).toContain("'exception_finance_alert'].includes(eventType)");
    expect(edge).toContain("return 'finance'");
  });
});
