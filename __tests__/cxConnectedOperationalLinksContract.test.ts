import fs from 'node:fs';
import path from 'node:path';

const live = fs.readFileSync(path.join(process.cwd(), 'app/admin/live-availability/page.tsx'), 'utf8');
const vision = fs.readFileSync(path.join(process.cwd(), 'app/admin/freight-vision/page.tsx'), 'utf8');
const resources = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');
const returns = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/returns/page.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');

describe('CX connected operational module links', () => {
  it('keeps Live Availability and Return Journeys connected through the canonical primary navbar without duplicate header navigation', () => {
    expect(shell).toContain("['carrier-live-availability', 'Live Availability', '/admin/live-availability']");
    expect(shell).toContain("['carrier-return-journeys', 'Return Journeys', '/admin/fleet/returns']");
    expect(live).not.toContain("router.push('/admin/fleet/returns')");
    expect(live).toContain("router.push('/admin/fleet/drivers')");
    expect(live).toContain('Driver register');
    expect(live).not.toContain('>Return Journeys</ActionButton>');
    expect(live).not.toContain('/admin/drivers?driver=');
  });

  it('links Freight Vision into the canonical job, Diary, Replay and Messenger flows', () => {
    expect(vision).toContain("/admin/jobs/${job.id}");
    expect(vision).toContain("/admin/diary?job=${encodeURIComponent(job.id)}");
    expect(vision).toContain("/job-replay/${job.id}");
    expect(vision).toContain("/admin/messages?jobId=${encodeURIComponent(job.id)}");
    expect(vision).toContain('Diary');
    expect(vision).toContain('Replay');
  });

  it('opens the declared Return Journey route without creating a second routing contract', () => {
    expect(returns).toContain('returnRouteUrl');
    expect(returns).toContain('https://www.google.com/maps/dir/');
    expect(returns).toContain('Open Route');
    expect(returns).toContain('journey.from_postcode');
    expect(returns).toContain('journey.to_postcode');
  });

  it('routes the CX Drivers & Vehicles rail to the canonical company vehicle and tracking registers', () => {
    expect(resources).toContain('Users / Drivers</button>');
    expect(resources).toContain("router.push('/admin/vehicles')}>Company Vehicles</button>");
    expect(resources).toContain("router.push('/admin/fleet/positions')}>Vehicle Tracking</button>");
    expect(resources).not.toContain("router.push('/admin/drivers')");
    expect(resources).not.toContain("router.push('/admin/fleet/vehicles')");
  });

  it('does not create a second tracking or return-journey data source', () => {
    expect(vision).toContain('useCompanyWorkspaceData');
    expect(vision).toContain('useOperationsIntelligence');
    expect(live).toContain('useOperationsIntelligence');
    expect(live).not.toContain('/api/cx/');
    expect(vision).not.toContain('/api/cx/');
  });
});
