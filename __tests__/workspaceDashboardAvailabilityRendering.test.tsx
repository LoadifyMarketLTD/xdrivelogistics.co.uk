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

import { BrokerDashboard } from '../app/broker/BrokerWorkspaceModules';
import { CustomerDashboard } from '../app/customer/CustomerWorkspaceModules';
import { FinanceDashboard } from '../app/components/workspace/RoleDashboards';

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

describe('workspace dashboard degraded-state rendering', () => {
  beforeEach(() => {
    push.mockReset();
    mockUseCompanyWorkspaceData.mockReset();
  });

  it('renders customer invoice unavailability instead of an empty healthy state', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      datasets: {
        ...workspaceState().datasets,
        invoices: dataset({ availability: 'unavailable', successfulEmpty: false, queryErrors: ['invoice query failed'] }),
      },
    }));

    const html = render(<CustomerDashboard />);
    expect(html).toContain('Invoice data unavailable');
    expect(html).not.toContain('No outstanding invoices');
  });

  it('renders partial broker KPIs honestly when source rows are bounded', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'broker',
      datasets: {
        ...workspaceState().datasets,
        jobs: dataset({ partialData: true, limitedData: true, successfulEmpty: false }),
      },
    }));

    const html = render(<BrokerDashboard />);
    expect(html).toContain('Partial');
  });

  it('blocks broker supplier compliance behind the broker-approved backend contract', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'broker',
      datasets: {
        ...workspaceState().datasets,
        driverDocuments: dataset({ availability: 'omitted', requested: false, successfulEmpty: false }),
        vehicleDocuments: dataset({ availability: 'omitted', requested: false, successfulEmpty: false }),
      },
    }));

    const html = render(<BrokerDashboard />);
    expect(html).toContain('Supplier compliance unavailable');
    expect(html).toContain('Carrier network');
    expect(html).not.toContain('View all');
  });

  it('renders finance totals as partial instead of exact zeroes when invoices are partial', () => {
    mockUseCompanyWorkspaceData.mockReturnValue(workspaceState({
      surface: 'finance',
      datasets: {
        ...workspaceState().datasets,
        invoices: dataset({ partialData: true, successfulEmpty: false }),
      },
    }));

    const html = render(<FinanceDashboard />);
    expect(html).toContain('Partial');
    expect(html).not.toContain('£0.00');
  });
});
