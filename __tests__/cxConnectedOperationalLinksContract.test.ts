import fs from 'node:fs';
import path from 'node:path';

const live = fs.readFileSync(path.join(process.cwd(), 'app/admin/live-availability/page.tsx'), 'utf8');
const vision = fs.readFileSync(path.join(process.cwd(), 'app/admin/freight-vision/page.tsx'), 'utf8');

describe('CX connected operational module links', () => {
  it('links Live Availability and Return Journeys bidirectionally', () => {
    expect(live).toContain("router.push('/admin/fleet/returns')");
    expect(live).toContain('Return Journeys');
    expect(live).toContain('Return Journey');
  });

  it('links Freight Vision into the canonical job, Diary, Replay and Messenger flows', () => {
    expect(vision).toContain("/admin/jobs/${job.id}");
    expect(vision).toContain("/admin/diary?job=${encodeURIComponent(job.id)}");
    expect(vision).toContain("/job-replay/${job.id}");
    expect(vision).toContain("/admin/messages?jobId=${encodeURIComponent(job.id)}");
    expect(vision).toContain('Diary');
    expect(vision).toContain('Replay');
  });

  it('does not create a second tracking or return-journey data source', () => {
    expect(vision).toContain('useCompanyWorkspaceData');
    expect(vision).toContain('useOperationsIntelligence');
    expect(live).toContain('useOperationsIntelligence');
    expect(live).not.toContain('/api/cx/');
    expect(vision).not.toContain('/api/cx/');
  });
});
