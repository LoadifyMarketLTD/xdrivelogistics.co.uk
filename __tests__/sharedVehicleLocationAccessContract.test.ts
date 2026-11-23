import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('shared participant vehicle location access', () => {
  it('reuses one job sheet in Customer, Broker, Carrier and Owner Driver', () => {
    const sheet = read('app/components/workspace/CompanyJobSheetPanel.tsx');
    expect(sheet).toContain('Vehicle Location / Journey');
    expect(sheet).toContain("setTab('event-log')");
    expect(sheet).toContain('<WorkspaceJobReplay jobId={jobId} />');
    for (const page of [
      'app/customer/diary/page.tsx',
      'app/broker/diary/page.tsx',
      'app/components/workspace/OperationsDiaryPage.tsx',
      'app/driver/history/page.tsx',
    ]) expect(read(page)).toContain('<CompanyJobSheetPanel');
  });

  it('shows only recorded GPS data with last position and map focus', () => {
    const replay = read('app/components/workspace/WorkspaceJobReplay.tsx');
    expect(replay).toContain('Last recorded vehicle position:');
    expect(replay).toContain('Zoom to Vehicle');
    expect(replay).toContain("replay.points.at(-1)");
    expect(replay).toContain('No GPS journey samples recorded');
  });

  it('leaves location access under the existing server job authorization boundary', () => {
    const route = read('app/api/workspace/jobs/[jobId]/replay/route.ts');
    expect(route).toContain("if (!(membershipResult.data?.length || driverOwnsJob)) return json(403");
    expect(route).toContain(".eq('job_id', jobId)");
  });
});
