import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type AdoptionRow = {
  pageHeader: boolean;
  operationalToolbar: boolean;
  exchangeKpiStrip: boolean;
  operationalTable: boolean;
  quickActionGrid: boolean;
  financialSummaryPanel: boolean;
  complianceSummaryPanel: boolean;
  dateRangeSelector: boolean;
  savedViewSelector: boolean;
};

function rowFor(filePath: string): AdoptionRow {
  const source = readFileSync(resolve(process.cwd(), filePath), 'utf8');
  return {
    pageHeader: /\bPageHeader\b/.test(source),
    operationalToolbar: /\bOperationalToolbar\b/.test(source),
    exchangeKpiStrip: /\bExchangeKpiStrip\b/.test(source),
    operationalTable: /\bOperationalTable\b|\bDataTable\b/.test(source),
    quickActionGrid: /\bQuickActionGrid\b/.test(source),
    financialSummaryPanel: /\bFinancialSummaryPanel\b/.test(source),
    complianceSummaryPanel: /\bComplianceSummaryPanel\b/.test(source),
    dateRangeSelector: /\bDateRangeSelector\b/.test(source),
    savedViewSelector: /\bSavedViewSelector\b/.test(source),
  };
}

describe('workspace primitive adoption matrix', () => {
  it('tracks shared primitive adoption by role workspace', () => {
    const matrix = {
      broker: rowFor('app/broker/BrokerWorkspaceModules.tsx'),
      customer: rowFor('app/customer/CustomerWorkspaceModules.tsx'),
      driver: rowFor('app/driver/page.tsx'),
      admin: rowFor('app/admin/AdminWorkspaceModules.tsx'),
      operations: rowFor('app/admin/operations-centre/page.tsx'),
    };

    expect(matrix).toEqual({
      broker: {
        pageHeader: true,
        operationalToolbar: false,
        exchangeKpiStrip: true,
        operationalTable: true,
        quickActionGrid: true,
        financialSummaryPanel: true,
        complianceSummaryPanel: true,
        dateRangeSelector: true,
        savedViewSelector: false,
      },
      customer: {
        pageHeader: true,
        operationalToolbar: false,
        exchangeKpiStrip: false,
        operationalTable: true,
        quickActionGrid: false,
        financialSummaryPanel: false,
        complianceSummaryPanel: false,
        dateRangeSelector: false,
        savedViewSelector: false,
      },
      driver: {
        pageHeader: true,
        operationalToolbar: false,
        exchangeKpiStrip: false,
        operationalTable: true,
        quickActionGrid: false,
        financialSummaryPanel: false,
        complianceSummaryPanel: false,
        dateRangeSelector: false,
        savedViewSelector: false,
      },
      admin: {
        pageHeader: true,
        operationalToolbar: false,
        exchangeKpiStrip: false,
        operationalTable: true,
        quickActionGrid: false,
        financialSummaryPanel: false,
        complianceSummaryPanel: false,
        dateRangeSelector: false,
        savedViewSelector: false,
      },
      operations: {
        pageHeader: false,
        operationalToolbar: false,
        exchangeKpiStrip: false,
        operationalTable: false,
        quickActionGrid: false,
        financialSummaryPanel: false,
        complianceSummaryPanel: false,
        dateRangeSelector: false,
        savedViewSelector: false,
      },
    });
  });
});
