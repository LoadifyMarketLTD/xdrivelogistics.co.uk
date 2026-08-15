import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const mockUseCompanyWorkspaceData = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../app/components/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../app/components/workspace/useCompanyWorkspaceData', async () => {
  const actual = await vi.importActual<typeof import('../app/components/workspace/useCompanyWorkspaceData')>(
    '../app/components/workspace/useCompanyWorkspaceData'
  );
  return {
    ...actual,
    useCompanyWorkspaceData: () => mockUseCompanyWorkspaceData(),
  };
});

import BrokerDashboardHome from '../app/broker/BrokerDashboardHome';
import CustomerDashboardHome from '../app/customer/CustomerDashboardHome';
import CarrierOperationsDashboardHome, {
  isCarrierAttentionJob,
} from '../app/components/workspace/CarrierOperationsDashboardHome';
import FleetControlDashboardHome from '../app/components/workspace/FleetControlDashboardHome';
import DispatcherControlDashboardHome from '../app/components/workspace/DispatcherControlDashboardHome';
import FinanceControlDashboardHome from '../app/components/workspace/FinanceControlDashboardHome';
import ComplianceControlDashboardHome from '../app/components/workspace/ComplianceControlDashboardHome';
import ViewerDashboardHome from '../app/components/workspace/ViewerDashboardHome';
import type { WorkspaceJob } from '../app/components/workspace/useCompanyWorkspaceData';

const dataset = <T,>(overrides: Partial<{
  data: T[];
  availability: 'available' | 'unavailable' | 'omitted';
  partialData: boolean;
  limitedData: boolean;
  successfulEmpty: boolean;
  requested: boolean;
  queryErrors: string[];
}> = {}) => ({
  data: [],
  availability: 'available' as const,
  partialData: false,
  limitedData: false,
  successfulEmpty: true,
  requested: true,
  queryErrors: [],
  ...overrides,
});

const workspaceState = (overrides: Record<string, unknown> = {}) => ({
  companyId: 'company-1',
  loading: false,
  error: '',
  partialData: false,
  queryErrors: [],
  surface: 'customer',
  datasets: {
    jobs: dataset(),
    bids: dataset(),
    invoices: dataset(),
    drivers: dataset(),
    vehicles: dataset(),
    driverDocuments: dataset(),
    vehicleDocuments: dataset(),
    locations: dataset(),
  },
  jobs: [],
  bids: [],
  invoices: [],
  drivers: [],
  vehicles: [],
  driverDocuments: [],
  vehicleDocuments: [],
  locations: [],
  refresh: vi.fn(),
  ...overrides,
});

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const carrierJob = (overrides: Partial<WorkspaceJob> = {}): WorkspaceJob => ({
  id: 'job-1',
  company_id: 'company-1',
  status: 'posted',
  current_status: 'posted',
  pickup_location: 'Blackburn',
  delivery_location: 'Manchester',
  pickup_datetime: '2026-08-10T09:00:00.000Z',
  delivery_datetime: '2026-08-10T11:00:00.000Z',
  vehicle_type: 'luton_van',
  assigned_driver_id: null,
  delivery_photos: [],
  created_at: '2026-08-09T09:00:00.000Z',
  updated_at: '2026-08-09T09:00:00.000Z',
  ...overrides,
});

describe('carrier attention semantics', () => {
  it('keeps a normal live job out of Needs attention', () => {
    expect(isCarrierAttentionJob(carrierJob({
      status: 'allocated',
      current_status: 'in_transit',
      assigned_driver_id: 'driver-1',
      awarded_carrier_company_id: 'company-1',
    }))).toBe(false);
  });

  it('includes only actionable allocation, exception and delivery-evidence blockers', () => {
    expect(isCarrierAttentionJob(carrierJob({
      status: 'awarded',
      current_status: 'awarded',
      awarded_carrier_company_id: 'company-1',
    }))).toBe(true);
    expect(isCarrierAttentionJob(carrierJob({
      status: 'failed',
      current_status: 'delivery_failed',
      assigned_driver_id: 'driver-1',
      awarded_carrier_company_id: 'company-1',
    }))).toBe(true);
    expect(isCarrierAttentionJob(carrierJob({
      status: 'delivered',
      current_status: 'delivered',
      assigned_driver_id: 'driver-1',
      awarded_carrier_company_id: 'company-1',
      delivery_photos: [],
    }))).toBe(true);
    expect(isCarrierAttentionJob(carrierJob({
      status: 'delivered',
      current_status: 'delivered',
      assigned_driver_id: 'driver-1',
      awarded_carrier_company_id: 'company-1',
      delivery_photos: ['pod.jpg'],
    }))).toBe(false);
  });
});

describe('active workspace dashboard degraded-state rendering', () => {
  beforeEach(() => {
    push.mockReset();
    mockUseCompanyWorkspaceData.mockReset();
  });

  it('does not present an unavailable customer invoice source as a healthy empty-state message', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      datasets: {
        ...workspaceState().datasets,
        invoices: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['invoice query failed'] }),
      },
    }));

    const html = render(<CustomerDashboardHome />);
    expect(html).not.toContain('No outstanding invoices');
  });

  it('renders bounded broker source rows conservatively rather than as exact complete metrics', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'broker',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ partialData: true, limitedData: true, successfulEmpty: false }),
      },
    }));

    const html = render(<BrokerDashboardHome />);
    expect(html).toContain('Unavailable');
  });

  it('renders broker quote-decision unavailability instead of a healthy empty queue', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'broker',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['jobs query failed'] }),
      },
    }));

    const html = render(<BrokerDashboardHome />);
    expect(html).toContain('Quote decision data unavailable');
    expect(html).not.toContain('No award decisions waiting');
  });

  it('renders finance totals as partial instead of exact zeroes when invoices are partial', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'finance',
      datasets: {
        ...workspaceState().datasets,
        invoices: dataset({ partialData: true, successfulEmpty: false }),
      },
    }));

    const html = render(<FinanceControlDashboardHome />);
    expect(html).toContain('Partial');
    expect(html).not.toContain('£0.00');
  });

  it('renders carrier degraded panels honestly when jobs or invoice data are unavailable', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'carrier_operations',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['jobs query failed'] }),
        invoices: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['invoice query failed'] }),
        driverDocuments: dataset({ availability: 'omitted', requested: false, successfulEmpty: false }),
        vehicleDocuments: dataset({ availability: 'omitted', requested: false, successfulEmpty: false }),
      },
    }));

    const html = render(<CarrierOperationsDashboardHome />);
    expect(html).toContain('Job data unavailable');
    expect(html).not.toContain('No jobs require attention');
    expect(html).toContain('Document expiry alerts');
    expect(html).toContain('Commercial position');
    expect(html).not.toContain('£0.00');
  });

  it('does not present partial carrier invoice data as an exact finance zero', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'carrier_operations',
      datasets: {
        ...workspaceState().datasets,
        invoices: dataset({ partialData: true, successfulEmpty: false }),
      },
    }));

    const html = render(<CarrierOperationsDashboardHome />);
    expect(html).toContain('Overdue invoices');
    expect(html).toContain('Commercial position');
    expect(html).not.toContain('£0.00');
  });

  it('renders the simplified fleet resource dashboard honestly for unavailable and partial datasets', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'fleet',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['jobs query failed'] }),
        drivers: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['driver query failed'] }),
        vehicles: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['vehicle query failed'] }),
        driverDocuments: dataset({ partialData: true, successfulEmpty: false }),
        vehicleDocuments: dataset({ partialData: true, successfulEmpty: false }),
        locations: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['location query failed'] }),
      },
    }));

    const html = render(<FleetControlDashboardHome />);
    expect(html).toContain('Fleet attention data unavailable');
    expect(html).not.toContain('No fleet attention items');
    expect(html).toContain('Driver data unavailable');
    expect(html).toContain('Documents expiring');
    expect(html).toContain('Partial');
    expect(html).toContain('Operational vehicle availability is not exposed by the verified Fleet dataset');
    expect(html).not.toContain('Allocation board');
    expect(html).not.toContain('Live fleet execution');
    expect(html).not.toContain('Capacity matrix');
  });

  it('renders dispatcher job failure as an unavailable dispatch feed', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'dispatcher',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['jobs query failed'] }),
      },
    }));

    const html = render(<DispatcherControlDashboardHome />);
    expect(html).toContain('Dispatch feed unavailable');
    expect(html).not.toContain('No dispatch priorities');
  });

  it('renders compliance document failure as an unavailable verification queue', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'compliance',
      datasets: {
        ...workspaceState().datasets,
        driverDocuments: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['driver document query failed'] }),
        vehicleDocuments: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['vehicle document query failed'] }),
      },
    }));

    const html = render(<ComplianceControlDashboardHome />);
    expect(html).toContain('Document data unavailable');
    expect(html).not.toContain('No priority documents');
  });

  it('keeps the viewer degraded state read-only and explicit', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'viewer',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['jobs query failed'] }),
      },
    }));

    const html = render(<ViewerDashboardHome />);
    expect(html).toContain('Job data unavailable');
    expect(html).not.toContain('Allocate Work');
    expect(html).not.toContain('Find Loads');
    expect(html).not.toContain('Open Invoices');
  });
});
