import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(filePath: string): string {
  return readFileSync(resolve(process.cwd(), filePath), 'utf8');
}

function hasOperationalTablePrimitive(filePath: string): boolean {
  const source = read(filePath);
  return /\bOperationalTable\b|\bDataTable\b|customer-dash-table|driver-dash-table/.test(source);
}

function hasPageHeader(filePath: string): boolean {
  const source = read(filePath);
  return /\bPageHeader\b|\bDashboardHomeHeader\b|\bDriverWorkspaceShell\b/.test(source);
}

function hasCompactKpiStrip(filePath: string): boolean {
  const source = read(filePath);
  return /\bExchangeKpiStrip\b|\bKpiGrid\b|\bCarrierControlSignals\b|customer-dash-metrics|driver-dash-metrics/.test(source);
}

function hasActionCentreRoute(filePath: string): boolean {
  if (!existsSync(resolve(process.cwd(), filePath))) return false;
  const source = read(filePath);
  return source.includes('ActionCentrePage');
}

function rowFor(filePath: string) {
  const source = readFileSync(resolve(process.cwd(), filePath), 'utf8');
  return {
    pageHeader: /\bPageHeader\b|\bDashboardHomeHeader\b|\bDriverWorkspaceShell\b/.test(source),
    operationalToolbar: /\bOperationalToolbar\b|\bActionCentrePage\b/.test(source),
    exchangeKpiStrip: /\bExchangeKpiStrip\b|\bKpiGrid\b|\bCarrierControlSignals\b|customer-dash-metrics|driver-dash-metrics/.test(source),
    operationalTable: /\bOperationalTable\b|\bDataTable\b|customer-dash-table|driver-dash-table/.test(source),
    quickActionGrid: /\bQuickActionGrid\b|\bActionCentrePage\b/.test(source),
    financialSummaryPanel: /\bFinancialSummaryPanel\b/.test(source),
    complianceSummaryPanel: /\bComplianceSummaryPanel\b/.test(source),
    dateRangeSelector: /\bDateRangeSelector\b|\bActionCentrePage\b/.test(source),
    savedViewSelector: /\bSavedViewSelector\b|\bActionCentrePage\b/.test(source),
  };
}

const activeAdminDashboardFiles = [
  'app/components/workspace/CarrierOperationsDashboardHome.tsx',
  'app/components/workspace/FleetControlDashboardHome.tsx',
  'app/components/workspace/DispatcherControlDashboardHome.tsx',
  'app/components/workspace/FinanceControlDashboardHome.tsx',
  'app/components/workspace/ComplianceControlDashboardHome.tsx',
  'app/components/workspace/ViewerDashboardHome.tsx',
];

describe('workspace primitive adoption matrix', () => {
  it('ensures each active role dashboard has a principal operational table surface', () => {
    for (const filePath of [
      'app/broker/BrokerDashboardHome.tsx',
      'app/customer/CustomerDashboardHome.tsx',
      'app/driver/page.tsx',
      ...activeAdminDashboardFiles,
    ]) {
      expect(hasPageHeader(filePath), `${filePath} should use the shared page-header family`).toBe(true);
      expect(hasOperationalTablePrimitive(filePath), `${filePath} should expose an operational table`).toBe(true);
      expect(hasCompactKpiStrip(filePath), `${filePath} should expose a compact operational signal strip`).toBe(true);
    }
  });

  it('ensures action-centre routes for all operational roles use the shared primitive page', () => {
    expect(hasActionCentreRoute('app/broker/action-centre/page.tsx')).toBe(true);
    expect(hasActionCentreRoute('app/customer/action-centre/page.tsx')).toBe(true);
    expect(hasActionCentreRoute('app/driver/action-centre/page.tsx')).toBe(true);
    expect(hasActionCentreRoute('app/admin/action-centre/page.tsx')).toBe(true);
  });

  it('tracks shared primitive adoption on the active dashboard files', () => {
    const matrix = {
      broker: rowFor('app/broker/BrokerDashboardHome.tsx'),
      customer: rowFor('app/customer/CustomerDashboardHome.tsx'),
      driver: rowFor('app/driver/page.tsx'),
      carrier: rowFor('app/components/workspace/CarrierOperationsDashboardHome.tsx'),
      fleet: rowFor('app/components/workspace/FleetControlDashboardHome.tsx'),
      dispatcher: rowFor('app/components/workspace/DispatcherControlDashboardHome.tsx'),
      finance: rowFor('app/components/workspace/FinanceControlDashboardHome.tsx'),
      compliance: rowFor('app/components/workspace/ComplianceControlDashboardHome.tsx'),
      viewer: rowFor('app/components/workspace/ViewerDashboardHome.tsx'),
      operations: rowFor('app/admin/action-centre/page.tsx'),
    };

    expect(matrix.broker.operationalTable).toBe(true);
    expect(matrix.customer.operationalTable).toBe(true);
    expect(matrix.carrier.operationalTable).toBe(true);
    expect(matrix.fleet.operationalTable).toBe(true);
    expect(matrix.dispatcher.operationalTable).toBe(true);
    expect(matrix.finance.operationalTable).toBe(true);
    expect(matrix.compliance.operationalTable).toBe(true);
    expect(matrix.viewer.operationalTable).toBe(true);
    expect(matrix.operations.operationalToolbar).toBe(true);
    expect(matrix.operations.savedViewSelector).toBe(true);
    expect(matrix.operations.dateRangeSelector).toBe(true);
  });

  it('keeps the active carrier dashboard on the Courier Exchange-derived control-desk family', () => {
    const source = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');

    expect(source).toContain('DashboardHomeHeader');
    expect(source).toContain('CarrierControlSignals');
    expect(source).toContain('OperationalToolbar');
    expect(source).toContain('OperationalPageLayout');
    expect(source).toContain('OperationalFilters');
    expect(source).toContain('<DataTable');
    expect(source).toContain('Operational workboard');
    expect(source).toContain('Resource readiness');
    expect(source).toContain('Commercial position');
    expect(source).toContain('Carrier workflow');
    expect(source).not.toContain('<KpiGrid>');
    expect(source).not.toContain('QuickActionGrid');
    expect(source).not.toContain('FinancialSummaryPanel');
  });

  it('keeps customer and broker KPI availability on the shared metric presentation helper', () => {
    const customerSource = read('app/customer/CustomerDashboardHome.tsx');
    const brokerSource = read('app/broker/BrokerDashboardHome.tsx');

    expect(customerSource).toContain('getWorkspaceMetricPresentation');
    expect(brokerSource).toContain('getWorkspaceMetricPresentation');
    expect(customerSource).toContain('getWorkspaceMetricPresentationStatus');
    expect(brokerSource).toContain('getWorkspaceMetricPresentationStatus');
  });

  it('keeps RoleDashboards as compatibility exports rather than a second implementation', () => {
    const source = read('app/components/workspace/RoleDashboards.tsx');

    expect(source).toContain('Compatibility exports only');
    expect(source).toContain("from './CarrierOperationsDashboardHome'");
    expect(source).toContain("from './FleetControlDashboardHome'");
    expect(source).toContain("from './FinanceControlDashboardHome'");
    expect(source).not.toContain('export function CarrierDashboard()');
    expect(source).not.toContain('useCompanyWorkspaceData');
  });
});
