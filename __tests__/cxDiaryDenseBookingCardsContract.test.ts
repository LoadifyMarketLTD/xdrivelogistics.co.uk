import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const diaryCard = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CxDiaryCard.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyJobSheetPanel.tsx'), 'utf8');

describe('CX-density carrier Diary contract', () => {
  it('adds the CX-style operational search dimensions without a new data source', () => {
    expect(diary).toContain('Booking Scope');
    expect(diary).toContain('Jobs Sub-contracted');
    expect(diary).toContain('Our Bookings');
    expect(diary).toContain('Pickup Time Within:');
    expect(diary).toContain('Delivery Time Within:');
    expect(diary).toContain('Load ID / Ref:');
    expect(diary).toContain(".from('jobs')");
    expect(diary).not.toContain('/api/diary/');
  });

  it('keeps the CX collapsed card dense and retains freight/evidence in the expandable record detail', () => {
    expect(diary).toContain('CxDiaryCard');
    expect(diaryCard).toContain('xdrive-cx-diary-card__main');
    expect(diaryCard).toContain('xdrive-cx-diary-card__expanded-meta');
    expect(diary).toContain('requested_cargo_label');
    expect(diary).toContain('job_distance_miles');
    expect(diary).toContain('weight_kg');
    expect(diary).toContain('pallets');
    expect(diary).toContain('Hard-copy POD:');
    expect(diary).toContain('Load Notes:');
  });

  it('opens the existing authorised job-sheet tabs from the CX footer and expanded operational actions', () => {
    for (const tabId of ['exception', 'payment', 'dispute']) {
      expect(diary).toContain(`openJobTab(job.id, '${tabId}')`);
    }
    expect(diary).toContain('openJobTab(job.id, DIARY_JOB_SHEET_TABS[tab])');
    expect(sheet).toContain('initialTab?: JobSheetTab');
    expect(sheet).toContain('setTab(normalizeTab(initialTab))');
  });

  it('preserves allocation behind the authorised endpoint', () => {
    expect(diary).toContain('/api/admin/jobs/${encodeURIComponent(job.id)}/assign-driver');
    expect(diary).toContain('Full operational eligibility is verified by the server.');
  });
});
