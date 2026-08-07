import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(filePath: string): string {
  return readFileSync(resolve(process.cwd(), filePath), 'utf8');
}

function hasOperationalTablePrimitive(filePath: string): boolean {
  const source = read(filePath);
  return /\bOperationalTable\b|\bDataTable\b/.test(source);
}

function hasPageHeader(filePath: string): boolean {
  const source = read(filePath);
  return /\bPageHeader\b/.test(source);
}

function hasCompactKpiStrip(filePath: string): boolean {
  const source = read(filePath);
  return /\bExchangeKpiStrip\b|\bKpiGrid\b/.test(source);
}

function hasActionCentreRoute(filePath: string): boolean {
  if (!existsSync(resolve(process.cwd(), filePath))) return false;
  const source = read(filePath);
  return source.includes('ActionCentrePage');
}

function rowFor(filePath: string) {
  const source = readFileSync(resolve(process.cwd(), filePath), 'utf8');
  return {
    pageHeader: /\bPageHeader\b/.test(source),
    operationalToolbar: /\bOperationalToolbar\b|\bActionCentrePage\b/.test(source),
    exchangeKpiStrip: /\bExchangeKpiStrip\b|\bKpiGrid\b/.test(source),
    operationalTable: /\bOperationalTable\b|\bDataTable\b/.test(source),
    quickActionGrid: /\bQuickActionGrid\b|\bActionCentrePage\b/.test(source),
    financialSummaryPanel: /\bFinancialSummaryPanel\b/.test(source),
    complianceSummaryPanel: /\bComplianceSummaryPanel\b/.test(source),
    dateRangeSelector: /\bDateRangeSelector\b|\bActionCentrePage\b/.test(source),
    savedViewSelector: /\bSavedViewSelector\b|\bActionCentrePage\b/.test(source),
  };
}

describe('workspace primitive adoption matrix', () => {
  it('ensures each role has a principal operational table surface', () => {
    expect(hasPageHeader('app/broker/BrokerWorkspaceModules.tsx')).toBe(true);
    expect(hasOperationalTablePrimitive('app/broker/BrokerWorkspaceModules.tsx')).toBe(true);
    expect(hasCompactKpiStrip('app/broker/BrokerWorkspaceModules.tsx')).toBe(true);

    expect(hasPageHeader('app/customer/CustomerWorkspaceModules.tsx')).toBe(true);
    expect(hasOperationalTablePrimitive('app/customer/CustomerWorkspaceModules.tsx')).toBe(true);
    expect(hasCompactKpiStrip('app/customer/CustomerWorkspaceModules.tsx')).toBe(true);

    expect(hasPageHeader('app/driver/page.tsx')).toBe(true);
    expect(hasOperationalTablePrimitive('app/driver/page.tsx')).toBe(true);
    expect(hasCompactKpiStrip('app/driver/page.tsx')).toBe(true);

    expect(hasPageHeader('app/admin/AdminWorkspaceModules.tsx')).toBe(true);
    expect(hasOperationalTablePrimitive('app/admin/AdminWorkspaceModules.tsx')).toBe(true);
    expect(hasCompactKpiStrip('app/admin/AdminWorkspaceModules.tsx')).toBe(true);
  });

  it('ensures action-centre routes for all operational roles use the shared primitive page', () => {
    expect(hasActionCentreRoute('app/broker/action-centre/page.tsx')).toBe(true);
    expect(hasActionCentreRoute('app/customer/action-centre/page.tsx')).toBe(true);
    expect(hasActionCentreRoute('app/driver/action-centre/page.tsx')).toBe(true);
    expect(hasActionCentreRoute('app/admin/action-centre/page.tsx')).toBe(true);
  });

  it('tracks shared primitive adoption by role workspace', () => {
    const matrix = {
      broker: rowFor('app/broker/BrokerWorkspaceModules.tsx'),
      customer: rowFor('app/customer/CustomerWorkspaceModules.tsx'),
      driver: rowFor('app/driver/page.tsx'),
      admin: rowFor('app/admin/AdminWorkspaceModules.tsx'),
      operations: rowFor('app/admin/action-centre/page.tsx'),
    };

    expect(matrix.broker.operationalTable).toBe(true);
    expect(matrix.customer.operationalTable).toBe(true);
    expect(matrix.driver.operationalTable).toBe(true);
    expect(matrix.admin.operationalTable).toBe(true);
    expect(matrix.operations.operationalToolbar).toBe(true);
    expect(matrix.operations.savedViewSelector).toBe(true);
    expect(matrix.operations.dateRangeSelector).toBe(true);
  });

  it('keeps carrier workspace summary panels on the shared card family', () => {
    const source = read('app/components/workspace/RoleDashboards.tsx');

    expect(source).toContain('ActionCard');
    expect(source).toContain('<KpiGrid>');
    expect(source).not.toContain('OperationalLinkList');
    expect(source).toContain('description="Available transport work"');
    expect(source).toContain('description="Carrier pricing workflow"');
    expect(source).toContain('description="Assign driver and vehicle"');
    expect(source).toContain('description="Live collections and deliveries"');
    expect(source).toContain('description="Billing and payment status"');
  });

  it('keeps customer and broker KPI availability on the shared metric presentation helper', () => {
    const customerSource = read('app/customer/CustomerWorkspaceModules.tsx');
    const brokerSource = read('app/broker/BrokerWorkspaceModules.tsx');

    expect(customerSource).toContain('getWorkspaceMetricPresentation');
    expect(brokerSource).toContain('getWorkspaceMetricPresentation');
    expect(customerSource).not.toContain('const datasetUnavailable =');
    expect(customerSource).not.toContain('const metricValue =');
    expect(brokerSource).not.toContain('const datasetUnavailable =');
    expect(brokerSource).not.toContain('const metricValue =');
  });
});
