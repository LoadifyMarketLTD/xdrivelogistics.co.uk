import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const MIGRATION = 'supabase/migrations/20260930123000_exception_closure_engine_automation.sql';

describe('Exception Closure Engine automation', () => {
  it('auto-assigns engine cases and escalates overdue obligations with audit events', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('service_reconcile_platform_case_obligations');
    expect(migration).toContain("'auto_assigned'");
    expect(migration).toContain("'customer_update_overdue'");
    expect(migration).toContain("'closure_overdue'");
    expect(migration).toContain('customer_update_escalated_count');
    expect(migration).toContain('closure_escalated_count');
  });

  it('keeps automation service-controlled', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain('assert_platform_owner_actor');
  });

  it('schedules one canonical minute-level Supabase Cron reconciliation function', () => {
    const migration = readRepoFile(MIGRATION);
    expect(migration).toContain('service_reconcile_exception_closure_engine');
    expect(migration).toContain("'xdrive-exception-closure-reconcile'");
    expect(migration).toContain("'* * * * *'");
    expect(migration).toContain('cron.unschedule');
    expect(migration).toContain('SELECT public.service_reconcile_exception_closure_engine()');
    expect(migration).not.toContain('supabase_service_role_key');
    expect(migration).not.toContain('net.http_post');
  });

  it('covers the canonical detector set inside the scheduled database reconciliation', () => {
    const migration = readRepoFile(MIGRATION);
    for (const detector of [
      'pickup_overdue',
      'delivery_overdue',
      'driver_status_stale',
      'driver_gps_stale',
      'pod_missing',
      'pod_remediation',
      'delivered_without_invoice',
      'job_unallocated_collection_imminent',
    ]) {
      expect(migration).toContain(detector);
    }
    expect(migration).toContain('service_reconcile_platform_case_sla');
    expect(migration).toContain('service_reconcile_platform_case_obligations');
  });

  it('leaves the manual reconciliation endpoint owner-only and preview-safe', () => {
    const route = readRepoFile('app/api/super-admin/cases/reconcile/route.ts');
    expect(route).toContain('isSuperAdminDeployPreviewReadOnly(request)');
    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(route).not.toContain('getBearerToken');
  });

  it('includes obligation reconciliation in the canonical manual reconciliation service', () => {
    const service = readRepoFile('lib/exception-closure/reconcileJobExceptions.ts');
    expect(service).toContain('service_reconcile_platform_case_obligations');
    expect(service).toContain('autoAssigned');
    expect(service).toContain('customerUpdateEscalated');
    expect(service).toContain('closureEscalated');
  });
});
