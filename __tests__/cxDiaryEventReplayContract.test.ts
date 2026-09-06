import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX-inspired Diary / Event Log / Journey Replay convergence', () => {
  const replayApi = read('app/api/workspace/jobs/[jobId]/replay/route.ts');
  const replay = read('app/components/workspace/WorkspaceJobReplay.tsx');
  const replayPage = read('app/job-replay/[jobId]/page.tsx');
  const jobSheet = read('app/components/workspace/CompanyJobSheetPanel.tsx');
  const driverJob = read('app/components/workspace/DriverJobExecutionPage.tsx');
  const operationsDiary = read('app/components/workspace/OperationsDiaryPage.tsx');
  const brokerDiary = read('app/broker/diary/page.tsx');
  const customerDiary = read('app/customer/diary/page.tsx');

  it('authorises exact post-award replay by participant company or assigned driver', () => {
    expect(replayApi).toContain("from('company_memberships')");
    expect(replayApi).toContain("from('drivers')");
    expect(replayApi).toContain('driverOwnsJob');
    expect(replayApi).toContain('You do not have access to this Journey Replay');
  });

  it('uses canonical job GPS and lifecycle evidence without inventing a route', () => {
    expect(replayApi).toContain("from('driver_locations')");
    expect(replayApi).toContain(".eq('job_id', jobId)");
    expect(replayApi).toContain('geographyPoint');
    expect(replayApi).toContain("from('job_tracking_events')");
    expect(replay).toContain('No GPS journey samples recorded');
  });

  it('provides map, tracked distance, speed evidence, timeline and CSV export', () => {
    expect(replay).toContain('Journey Replay map');
    expect(replay).toContain('Tracked distance');
    expect(replay).toContain('Average speed');
    expect(replay).toContain('Download Replay CSV');
    expect(replay).toContain('Operational timeline');
    expect(replayPage).toContain('<WorkspaceJobReplay jobId={jobId} />');
  });

  it('connects Replay from company job sheets and Driver execution', () => {
    expect(jobSheet).toContain("{ id: 'replay', label: 'Replay' }");
    expect(jobSheet).toContain("tab === 'replay'");
    expect(driverJob).toContain('title="Journey Replay"');
    expect(driverJob).toContain('<WorkspaceJobReplay jobId={jobId} />');
  });

  it('connects operational Diaries to the same Replay surface', () => {
    expect(operationsDiary).toContain('/job-replay/${job.id}');
    expect(brokerDiary).toContain('/job-replay/${job.id}');
    expect(customerDiary).toContain('/job-replay/${job.id}');
  });

  it('keeps Replay independent from Super Admin', () => {
    for (const source of [replayApi, replay, replayPage, jobSheet, driverJob]) expect(source).not.toContain('/super-admin');
  });
});
