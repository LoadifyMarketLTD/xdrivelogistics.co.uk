import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('cross-workspace Diary stability contract', () => {
  const workspaceData = read('app/components/workspace/useCompanyWorkspaceData.ts');
  const sheet = read('app/components/workspace/CompanyJobSheetPanel.tsx');
  const operationsDiary = read('app/components/workspace/OperationsDiaryPage.tsx');
  const driverDiary = read('app/driver/history/page.tsx');
  const companySnapshot = read('app/api/driver/diary/company-snapshot/route.ts');

  it('prevents overlapping background refreshes and preserves loaded workspace data during polling', () => {
    expect(workspaceData).toContain('refreshInFlightRef.current');
    expect(workspaceData).toContain('if (!hasLoadedRef.current) setLoading(true)');
    expect(workspaceData).toContain('useVisibleRefresh(refresh');
    expect(workspaceData).toContain('intervalMs: 10_000');
    expect(operationsDiary).toContain('loadInFlightRef.current');
    expect(operationsDiary).toContain('if (!hasLoadedRef.current) setLoading(true)');
  });

  it('limits shared expanded job-sheet concurrency across Customer, Broker and carrier shells', () => {
    expect(sheet).toContain('const SHEET_FETCH_CONCURRENCY = 4');
    expect(sheet).toContain('runSheetFetchLimited');
    expect(sheet).not.toContain('sheetCache');
  });

  it('gives owner/admin Driver workspace a company Diary while keeping employed drivers on assigned jobs', () => {
    expect(driverDiary).toContain("const diaryScope: 'company' | 'mine' = canViewCompanyDiary ? selectedDiaryScope : 'mine'");
    expect(driverDiary).toContain('Company Diary');
    expect(driverDiary).toContain('<option value="mine">My bookings</option>');
    expect(driverDiary).toContain('/api/driver/diary/company-snapshot');
    expect(companySnapshot).toContain("if (!['owner', 'admin'].includes(role))");
    expect(companySnapshot).toContain('assigned_company_id.eq.');
    expect(companySnapshot).toContain('awarded_carrier_company_id.eq.');
  });

  it('bounds historical date filters so Last 7/30 days cannot include future work', () => {
    expect(driverDiary).toContain('timestamp <= nowMs');
  });
});
