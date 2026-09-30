import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Exception reconciliation wiring', () => {
  it('covers the approved detector set with stable case keys', () => {
    const detector = readRepoFile('lib/exception-closure/jobExceptionDetectors.ts');
    for (const caseType of [
      'pickup_overdue',
      'delivery_overdue',
      'driver_status_stale',
      'driver_gps_stale',
      'pod_missing',
      'pod_remediation',
      'delivered_without_invoice',
      'job_unallocated_collection_imminent',
    ]) {
      expect(detector).toContain(caseType);
    }
    expect(detector).toContain('exception:${input.caseType}:job:${job.id}');
  });
  it('reconciles detected exceptions through canonical case RPCs', () => {
    const service = readRepoFile('lib/exception-closure/reconcileJobExceptions.ts');
    expect(service).toContain('owner_create_platform_case');
    expect(service).toContain('owner_set_platform_case_plan');
    expect(service).toContain('service_reconcile_platform_case_sla');
    expect(service).toContain('driver_locations');
    expect(service).toContain('invoices');
  });

  it('exposes an owner-only, deploy-preview-safe reconcile endpoint', () => {
    const route = readRepoFile('app/api/super-admin/cases/reconcile/route.ts');
    expect(route).toContain('verifyPlatformOwner');
    expect(route).toContain('isSuperAdminDeployPreviewReadOnly');
    expect(route).toContain('reconcileJobExceptions');
    expect(route).toContain('Deploy Preview is read-only');
  });

  it('surfaces reconciliation from the Action Centre without bypassing auth', () => {
    const page = readRepoFile('app/super-admin/action-centre/page.tsx');
    expect(page).toContain('Reconcile exceptions');
    expect(page).toContain('getAuthHeader()');
    expect(page).toContain('/api/super-admin/cases/reconcile');
    expect(page).toContain('reconciling');
  });
});
