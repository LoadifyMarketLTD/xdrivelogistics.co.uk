import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('XDrive spreadsheet reports contract', () => {
  it('exports real XLSX workbooks with XDrive formatting and worksheet controls', () => {
    const source = read('lib/spreadsheetExport.ts');
    expect(source).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(source).toContain("await import('exceljs')");
    expect(source).toContain("state: 'frozen'");
    expect(source).toContain('sheet.autoFilter');
    expect(source).toContain("workbook.company = 'XDrive Logistics Ltd'");
  });

  it('exposes finance registers as XLSX and a consolidated workbook', () => {
    const source = read('app/admin/AdminWorkspaceModules.tsx');
    expect(source).toContain('Export Full Workbook');
    expect(source).toContain('xdrive-reports-and-data.xlsx');
    expect(source).toContain('Export XLSX');
    expect(source).toContain("name: 'Invoices'");
    expect(source).toContain("name: 'Outstanding'");
    expect(source).toContain("name: 'Jobs'");
  });

  it('exports filtered finance statements as XLSX', () => {
    const source = read('app/admin/finance/statements/page.tsx');
    expect(source).toContain('Export Statement XLSX');
    expect(source).toContain("name: 'Summary'");
    expect(source).toContain("name: 'Statement'");
  });

  it('surfaces Statements and Reports & Data in company and finance navigation', () => {
    const source = read('lib/workspaceRole.ts');
    expect(source).toContain("label: 'Statements'");
    expect(source).toContain("label: 'Reports & Data'");
    expect(source).toContain("href: '/admin/finance/reports'");
  });

  it('provides controlled XLSX bulk booking import through the canonical jobs create endpoint', () => {
    const source = read('app/components/workspace/BulkBookingImport.tsx');
    expect(source).toContain('xdrive-bulk-booking-import-template.xlsx');
    expect(source).toContain('readXlsxSheetRows');
    expect(source).toContain("fetch('/api/jobs/create'");
    expect(source).toContain('Nothing is created during validation.');
    expect(source).toContain('Import stopped at Excel row');
    expect(read('app/admin/bulk-import/page.tsx')).toContain('mode="admin"');
    expect(read('app/customer/bulk-import/page.tsx')).toContain('mode="customer"');
  });
});
