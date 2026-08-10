import { describe, expect, it } from 'vitest';

import {
  DRIVER_WORKSPACE_INVOICE_BACKEND_BLOCKER,
  WORKSPACE_INVOICE_SELECT_POLICY_CONTRACT,
  createWorkspaceDatasetState,
  getWorkspaceDatasetMetricValue,
  getWorkspaceMetricPresentation,
  getWorkspaceMetricPresentationStatus,
  isCustomerVisibleWorkspaceInvoice,
  resolveWorkspaceDataQueryPlan,
} from '../app/components/workspace/useCompanyWorkspaceData';
import { resolveAdminDashboard } from '../app/components/workspace/AdminDashboardResolver';
import {
  resolveWorkspaceRole,
  resolveWorkspaceSurfaceRole,
  type WorkspaceRole,
} from '../lib/workspaceRole';

describe('workspace role and admin dashboard resolution', () => {
  it('resolves representative workspace roles explicitly', () => {
    expect(resolveWorkspaceRole({ role: 'company_admin', rawRole: 'carrier', membershipRole: 'owner' })).toBe('company_owner');
    expect(resolveWorkspaceRole({ role: 'company_admin', rawRole: 'carrier', membershipRole: 'admin' })).toBe('carrier_admin');
    expect(resolveWorkspaceRole({ role: 'company_staff', rawRole: 'dispatcher', membershipRole: 'dispatcher' })).toBe('dispatcher');
    expect(resolveWorkspaceRole({ role: 'company_staff', rawRole: 'fleet_manager', membershipRole: 'member' })).toBe('fleet_manager');
    expect(resolveWorkspaceRole({ role: 'company_staff', rawRole: 'finance', membershipRole: 'finance' })).toBe('finance');
    expect(resolveWorkspaceRole({ role: 'company_staff', rawRole: 'compliance', membershipRole: 'compliance' })).toBe('compliance');
    expect(resolveWorkspaceRole({ role: 'company_staff', rawRole: 'viewer', membershipRole: 'viewer' })).toBe('viewer');
    expect(resolveWorkspaceRole({ role: 'driver', rawRole: 'driver', membershipRole: 'driver' })).toBe('driver');
    expect(resolveWorkspaceRole({ role: 'driver', rawRole: 'driver', membershipRole: 'owner', ownerDriverWorkspace: true })).toBe('owner_driver');
    expect(resolveWorkspaceRole({ role: 'owner', rawRole: 'platform_owner' })).toBe('platform_owner');
  });

  it('resolves every accepted /admin workspace role without carrier fallthrough', () => {
    const accepted: Array<[WorkspaceRole, ReturnType<typeof resolveAdminDashboard>['target']]> = [
      ['company_owner', 'carrier'],
      ['company_admin', 'carrier'],
      ['carrier_admin', 'carrier'],
      ['fleet_manager', 'fleet'],
      ['dispatcher', 'dispatcher'],
      ['finance', 'finance'],
      ['compliance', 'compliance'],
      ['viewer', 'viewer'],
    ];

    for (const [role, expected] of accepted) {
      expect(resolveAdminDashboard(role)).toMatchObject({ target: expected, blocker: null });
    }
  });

  it('blocks non-admin workspaces and incomplete role context instead of falling through to carrier', () => {
    expect(resolveAdminDashboard('platform_owner')).toMatchObject({ target: 'blocked' });
    expect(resolveAdminDashboard('customer')).toMatchObject({ target: 'blocked' });
    expect(resolveAdminDashboard('broker')).toMatchObject({ target: 'blocked' });
    expect(resolveAdminDashboard('driver')).toMatchObject({ target: 'blocked' });
    expect(resolveAdminDashboard('owner_driver')).toMatchObject({ target: 'blocked' });
    expect(resolveAdminDashboard(null)).toMatchObject({ target: 'blocked' });
  });

  it('keeps owner_driver on /driver routes', () => {
    expect(resolveWorkspaceSurfaceRole('/driver/jobs', 'owner_driver')).toBe('owner_driver');
    expect(resolveWorkspaceSurfaceRole('/driver/quotes?tab=open', 'owner_driver')).toBe('owner_driver');
    expect(resolveWorkspaceSurfaceRole('/driver/jobs', 'driver')).toBe('driver');
  });
});

describe('workspace data query plans', () => {
  it('keeps the full carrier company-operations plan on /admin for company owner', () => {
    const plan = resolveWorkspaceDataQueryPlan({ pathname: '/admin', workspaceRole: 'company_owner' });
    expect(plan).toEqual({
      surface: 'carrier_operations',
      datasets: ['jobs', 'bids', 'invoices', 'drivers', 'vehicles', 'driverDocuments', 'vehicleDocuments', 'locations'],
      blocker: null,
    });
  });

  it('keeps customer data plans away from fleet datasets', () => {
    const plan = resolveWorkspaceDataQueryPlan({ pathname: '/customer', workspaceRole: 'customer' });
    expect(plan.surface).toBe('customer');
    expect(plan.datasets).toEqual(['jobs', 'bids', 'invoices']);
    expect(plan.datasets).not.toContain('drivers');
    expect(plan.datasets).not.toContain('vehicles');
    expect(plan.datasets).not.toContain('locations');
    expect(plan.datasets).not.toContain('driverDocuments');
    expect(plan.datasets).not.toContain('vehicleDocuments');
  });

  it('keeps broker plans away from the full carrier/fleet dataset bundle', () => {
    const plan = resolveWorkspaceDataQueryPlan({ pathname: '/broker', workspaceRole: 'broker' });
    expect(plan.surface).toBe('broker');
    expect(plan.datasets).toEqual(['jobs', 'bids', 'invoices']);
    expect(plan.datasets).not.toContain('drivers');
    expect(plan.datasets).not.toContain('vehicles');
    expect(plan.datasets).not.toContain('locations');
  });
});

describe('workspace dataset availability contracts', () => {
  it('does not turn a failed dataset KPI into zero', () => {
    const unavailableJobs = createWorkspaceDatasetState({
      requested: true,
      queryErrors: ['jobs query failed'],
    });

    expect(unavailableJobs.availability).toBe('unavailable');
    expect(unavailableJobs.limitedData).toBe(false);
    expect(unavailableJobs.successfulEmpty).toBe(false);
    expect(getWorkspaceDatasetMetricValue(unavailableJobs, (rows) => rows.length)).toBe('—');
  });

  it('distinguishes a successful empty dataset from unavailable data', () => {
    const emptyInvoices = createWorkspaceDatasetState({ requested: true, data: [] as Array<{ id: string }> });
    const unavailableInvoices = createWorkspaceDatasetState<{ id: string }>({ requested: true, queryErrors: ['invoice query failed'] });

    expect(emptyInvoices.availability).toBe('available');
    expect(emptyInvoices.limitedData).toBe(false);
    expect(emptyInvoices.successfulEmpty).toBe(true);
    expect(getWorkspaceDatasetMetricValue(emptyInvoices, (rows) => rows.length)).toBe(0);

    expect(unavailableInvoices.availability).toBe('unavailable');
    expect(unavailableInvoices.successfulEmpty).toBe(false);
    expect(getWorkspaceDatasetMetricValue(unavailableInvoices, (rows) => rows.length)).toBe('—');
  });

  it('treats partial datasets as degraded presentation instead of complete numerics', () => {
    const partialInvoices = createWorkspaceDatasetState({
      requested: true,
      data: [{ id: 'inv-1' }],
      queryErrors: ['carrier payable invoice query failed'],
    });

    expect(partialInvoices.availability).toBe('available');
    expect(partialInvoices.partialData).toBe(true);
    expect(partialInvoices.limitedData).toBe(false);
    expect(getWorkspaceMetricPresentationStatus([partialInvoices])).toBe('partial');
    expect(getWorkspaceDatasetMetricValue(partialInvoices, (rows) => rows.length)).toBe('Partial');

    expect(getWorkspaceMetricPresentation({
      datasets: [partialInvoices],
      completeValue: () => partialInvoices.data.length,
      completeDetail: 'Awaiting payment',
      completeTone: 'green',
    })).toEqual({
      status: 'partial',
      value: 'Partial',
      detail: 'Partial data unavailable',
      tone: 'navy',
    });
  });

  it('marks limit-capped datasets as partial instead of exact totals', () => {
    const limitedJobs = createWorkspaceDatasetState({
      requested: true,
      data: [{ id: 'job-1' }, { id: 'job-2' }],
      limitedData: true,
    });

    expect(limitedJobs.availability).toBe('available');
    expect(limitedJobs.partialData).toBe(true);
    expect(limitedJobs.limitedData).toBe(true);
    expect(getWorkspaceDatasetMetricValue(limitedJobs, (rows) => rows.length)).toBe('Partial');
  });

  it('preserves numeric and semantic presentation for complete datasets, including successful empty results', () => {
    const emptyJobs = createWorkspaceDatasetState({ requested: true, data: [] as Array<{ id: string }> });
    const completeJobs = createWorkspaceDatasetState({
      requested: true,
      data: [{ id: 'job-1' }, { id: 'job-2' }],
    });

    expect(getWorkspaceMetricPresentation({
      datasets: [emptyJobs],
      completeValue: 0,
      completeDetail: 'None outstanding',
      completeTone: 'green',
    })).toEqual({
      status: 'empty',
      value: 0,
      detail: 'None outstanding',
      tone: 'green',
    });

    expect(getWorkspaceMetricPresentation({
      datasets: [completeJobs],
      completeValue: () => completeJobs.data.length,
      completeDetail: 'Collections and deliveries',
      completeTone: 'red',
    })).toEqual({
      status: 'complete',
      value: 2,
      detail: 'Collections and deliveries',
      tone: 'red',
    });
  });

  it('uses the same neutral degraded presentation for unavailable and omitted datasets', () => {
    const unavailableJobs = createWorkspaceDatasetState<{ id: string }>({
      requested: true,
      queryErrors: ['jobs query failed'],
    });
    const omittedJobs = createWorkspaceDatasetState<{ id: string }>({
      requested: false,
    });

    expect(getWorkspaceMetricPresentation({
      datasets: [unavailableJobs],
      completeValue: 3,
      completeDetail: 'In progress',
      completeTone: 'green',
    })).toEqual({
      status: 'unavailable',
      value: '—',
      detail: 'Unavailable',
      tone: 'navy',
    });

    expect(getWorkspaceMetricPresentation({
      datasets: [omittedJobs],
      completeValue: 3,
      completeDetail: 'In progress',
      completeTone: 'green',
    })).toEqual({
      status: 'omitted',
      value: '—',
      detail: 'Unavailable',
      tone: 'navy',
    });
  });

  it('keeps customer invoices on the canonical buyer-company boundary', () => {
    expect(isCustomerVisibleWorkspaceInvoice({
      id: 'inv-a',
      buyer_company_id: 'customer-1',
      supplier_company_id: 'carrier-1',
      status: 'Sent',
      payment_status: 'unpaid',
      delivery_state: 'sent',
      amount: 120,
      created_at: '2026-08-01T00:00:00Z',
      client_name: 'Customer Co',
    }, 'customer-1')).toBe(true);

    expect(isCustomerVisibleWorkspaceInvoice({
      id: 'inv-b',
      buyer_company_id: 'other-customer',
      supplier_company_id: 'carrier-1',
      status: 'Sent',
      payment_status: 'unpaid',
      delivery_state: 'sent',
      amount: 120,
      created_at: '2026-08-01T00:00:00Z',
      client_name: 'Customer Co',
    }, 'customer-1')).toBe(false);
  });

  it('documents the verified invoice select-policy contract and driver fail-closed boundary', () => {
    expect(WORKSPACE_INVOICE_SELECT_POLICY_CONTRACT).toEqual([
      {
        name: 'invoices_select_non_driver',
        operation: 'SELECT',
        roles: ['public'],
        using: 'public.is_company_non_driver(company_id)',
        helpers: ['public.is_company_non_driver(company_id)', 'public.company_memberships', 'public.companies', 'public.profiles'],
        sourceMigrations: [
          'supabase/migrations/038_runtime_operational_rls_backstop.sql',
          'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql',
        ],
      },
      {
        name: 'invoices_job_owner_read',
        operation: 'SELECT',
        roles: ['authenticated'],
        using: "job_id IS NOT NULL AND lower(status::text) NOT IN ('pending', 'draft', 'cancelled') AND COALESCE(amount, 0) > 0 AND COALESCE(net_amount, 0) > 0 AND NULLIF(btrim(COALESCE(client_name, '')), '') IS NOT NULL AND (lower(status::text) = 'paid' OR lower(payment_status::text) = 'paid' OR (delivery_state = 'sent' AND NULLIF(btrim(COALESCE(delivery_provider, '')), '') IS NOT NULL AND NULLIF(btrim(COALESCE(delivery_message_id, '')), '') IS NOT NULL AND NULLIF(btrim(COALESCE(delivery_recipient_email, '')), '') IS NOT NULL)) AND EXISTS (SELECT 1 FROM public.jobs job WHERE job.id = invoices.job_id AND public.is_company_member(job.company_id))",
        helpers: ['public.jobs', 'public.is_company_member(job.company_id)'],
        sourceMigrations: [
          'supabase/migrations/20260723111500_invoice_snapshot_integrity.sql',
          'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql',
        ],
      },
    ]);
    expect(DRIVER_WORKSPACE_INVOICE_BACKEND_BLOCKER).toContain('job assignment alone is not an invoice visibility grant');
    expect(DRIVER_WORKSPACE_INVOICE_BACKEND_BLOCKER).toContain('There is no driver or owner-driver invoice SELECT policy');
  });
});
