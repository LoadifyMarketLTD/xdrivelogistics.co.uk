import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const BASE_MIGRATION = 'supabase/migrations/20260930123000_exception_closure_engine_automation.sql';
const ALIGNMENT_MIGRATION = 'supabase/migrations/20260930131500_exception_closure_finance_pod_alignment.sql';

describe('Exception Closure Engine automation', () => {
  it('auto-assigns engine cases and escalates overdue obligations with audit events', () => {
    const migration = readRepoFile(BASE_MIGRATION);
    expect(migration).toContain('service_reconcile_platform_case_obligations');
    expect(migration).toContain("'auto_assigned'");
    expect(migration).toContain("'customer_update_overdue'");
    expect(migration).toContain("'closure_overdue'");
    expect(migration).toContain('customer_update_escalated_count');
    expect(migration).toContain('closure_escalated_count');
  });

  it('keeps automation service-controlled', () => {
    const combined = readRepoFile(BASE_MIGRATION) + readRepoFile(ALIGNMENT_MIGRATION);
    expect(combined).toContain('SECURITY DEFINER');
    expect(combined).toContain('FROM PUBLIC, anon, authenticated');
    expect(combined).toContain('TO service_role');
    expect(combined).toContain('assert_platform_owner_actor');
  });

  it('schedules one canonical minute-level Supabase Cron reconciliation wrapper', () => {
    const alignment = readRepoFile(ALIGNMENT_MIGRATION);
    expect(alignment).toContain('service_reconcile_all_exception_closure');
    expect(alignment).toContain("'xdrive-exception-closure-reconcile'");
    expect(alignment).toContain("'* * * * *'");
    expect(alignment).toContain('cron.unschedule');
    expect(alignment).toContain('SELECT public.service_reconcile_all_exception_closure()');
    expect(alignment).not.toContain('supabase_service_role_key');
    expect(alignment).not.toContain('net.http_post');
  });

  it('covers the canonical detector set across operational and alignment migrations', () => {
    const combined = readRepoFile(BASE_MIGRATION) + readRepoFile(ALIGNMENT_MIGRATION);
    for (const detector of [
      'pickup_overdue',
      'delivery_overdue',
      'driver_status_stale',
      'driver_gps_stale',
      'pod_missing',
      'pod_rejected',
      'delivered_without_invoice',
      'invoice_generation_failed',
      'payment_overdue',
      'payment_disputed',
      'job_unallocated_collection_imminent',
    ]) {
      expect(combined).toContain(detector);
    }
    expect(combined).toContain('service_reconcile_platform_case_sla');
    expect(combined).toContain('service_reconcile_platform_case_obligations');
  });

  it('normalizes legacy POD remediation into canonical missing or rejected cases', () => {
    const alignment = readRepoFile(ALIGNMENT_MIGRATION);
    expect(alignment).toContain("p_case_type = 'pod_remediation'");
    expect(alignment).toContain("v_case_type := 'pod_rejected'");
    expect(alignment).toContain("v_case_type := 'pod_missing'");
    expect(alignment).toContain("'normalized_case_type'");
  });

  it('leaves the manual reconciliation endpoint owner-only and preview-safe', () => {
    const route = readRepoFile('app/api/super-admin/cases/reconcile/route.ts');
    expect(route).toContain('isSuperAdminDeployPreviewReadOnly(request)');
    expect(route).toContain('verifyPlatformOwner(request)');
    expect(route).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(route).not.toContain('getBearerToken');
  });

  it('includes finance and obligation reconciliation in the manual reconciliation service', () => {
    const service = readRepoFile('lib/exception-closure/reconcileJobExceptions.ts');
    expect(service).toContain('detectFinanceExceptions');
    expect(service).toContain('service_reconcile_platform_case_obligations');
    expect(service).toContain('autoAssigned');
    expect(service).toContain('customerUpdateEscalated');
    expect(service).toContain('closureEscalated');
  });
});
