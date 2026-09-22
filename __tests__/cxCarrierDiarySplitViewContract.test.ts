import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');

describe('CX carrier Diary list / split view parity', () => {
  it('offers the two CX Diary presentation modes', () => {
    expect(source).toContain("type DiaryViewMode = 'list' | 'split'");
    expect(source).toContain('List View');
    expect(source).toContain('Split View');
    expect(source).toContain("setViewMode('list')");
    expect(source).toContain("setViewMode('split')");
  });

  it('reuses the authorised CompanyJobSheetPanel in split view', () => {
    expect(source).toContain('Diary split booking detail');
    expect(source).toContain('<CompanyJobSheetPanel jobId={selectedJobId} mode="carrier" />');
    expect(source).not.toContain('/api/diary/');
  });

  it('keeps allocation available from the split booking list', () => {
    expect(source).toContain('Choose active driver');
    expect(source).toContain('void assignDriver(job)');
    expect(source).toContain('Full operational eligibility is verified by the server');
  });

  it('retains existing List View expand/collapse and Replay actions', () => {
    expect(source).toContain('toggleExpandAll');
    expect(source).toContain('toggleJob(job.id)');
    expect(source).toContain('/job-replay/');
  });
});
