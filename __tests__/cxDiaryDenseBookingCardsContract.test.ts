import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const sheet = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyJobSheetPanel.tsx'), 'utf8');

describe('CX-density carrier Diary contract', () => {
  it('adds the CX-style operational search dimensions without a new data source', () => {
    expect(diary).toContain('BOOKING SCOPE');
    expect(diary).toContain('Jobs Sub-contracted');
    expect(diary).toContain('Our Bookings');
    expect(diary).toContain('PICKUP TIME WITHIN');
    expect(diary).toContain('DELIVERY TIME WITHIN');
    expect(diary).toContain('LOAD ID / REF');
    expect(diary).toContain(".from('jobs')");
    expect(diary).not.toContain('/api/diary/');
  });

  it('surfaces route, schedule, freight and evidence before expansion', () => {
    expect(diary).toContain('requested_cargo_label');
    expect(diary).toContain('job_distance_miles');
    expect(diary).toContain('weight_kg');
    expect(diary).toContain('pallets');
    expect(diary).toContain('hard_copy_pod');
    expect(diary).toContain('Load notes:');
  });

  it('opens the existing authorised job-sheet tabs from each booking action bar', () => {
    expect(diary).toContain("(['order','notes','history','documents','pod','invoice','replay'] as JobSheetTab[])");
    expect(diary).toContain('openJobTab(job.id, tabId)');
    expect(sheet).toContain('initialTab?: JobSheetTab');
    expect(sheet).toContain('setTab(initialTab)');
  });

  it('preserves allocation behind the authorised endpoint', () => {
    expect(diary).toContain('/api/admin/jobs/${encodeURIComponent(job.id)}/assign-driver');
    expect(diary).toContain('Full operational eligibility is verified by the server.');
  });
});
