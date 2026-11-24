import { describe, expect, it } from 'vitest';
import { isCompanyDiaryJobChangeRelevant } from '../lib/diary/companyDiaryRealtime';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Company Admin Diary cross-device synchronization', () => {
  const known = new Set(['visible-job']);

  it('refreshes for the company posting a job', () => {
    expect(isCompanyDiaryJobChangeRelevant('company-a', known, { id: 'new-job', company_id: 'company-a' })).toBe(true);
  });

  it('refreshes for the carrier awarded or assigned to a job', () => {
    expect(isCompanyDiaryJobChangeRelevant('company-a', known, { id: 'job-2', awarded_carrier_company_id: 'company-a' })).toBe(true);
    expect(isCompanyDiaryJobChangeRelevant('company-a', known, { id: 'job-3', assigned_company_id: 'company-a' })).toBe(true);
  });

  it('refreshes when the previously known job moves away from the company', () => {
    expect(isCompanyDiaryJobChangeRelevant('company-a', known, { id: 'visible-job' })).toBe(true);
    expect(isCompanyDiaryJobChangeRelevant('company-a', known, null, { id: 'visible-job' })).toBe(true);
  });

  it('rejects unrelated changes and missing company scope', () => {
    expect(isCompanyDiaryJobChangeRelevant('company-a', known, { id: 'different', company_id: 'company-b' })).toBe(false);
    expect(isCompanyDiaryJobChangeRelevant('', known, { id: 'visible-job' })).toBe(false);
  });

  it('keeps Realtime subscriptions company-scoped on the client and polling as fallback', () => {
    const diary = readFileSync(resolve(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
    expect(diary).toContain("table: 'jobs'");
    expect(diary).toContain('isCompanyDiaryJobChangeRelevant(');
    expect(diary).toContain('intervalMs: 30_000');
    expect(diary).toContain('minGapMs: 5_000');
    expect(diary).toContain('void supabase.removeChannel(channel)');
    expect(diary).toContain('fixtureData || !companyId || !user?.id');
  });
});
