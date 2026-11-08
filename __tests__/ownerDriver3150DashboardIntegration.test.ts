import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
const page = read('app/driver/page.tsx');
const adapter = read('app/driver/_components/OwnerDriver3150LiveDashboard.tsx');
const original = read('app/try-xdrive-demo/components/DemoCompanyDashboard.tsx');
describe('Owner Driver Dashboard restores approved 3150 design with real data', () => {
  it('renders the approved 3150 visual component, rather than legacy finance dashboard, for Owner Driver', () => {
    expect(page).toContain("role === 'Owner Driver' ? <OwnerDriver3150LiveDashboard/> : <DriverDashboardContent/>");
    expect(adapter).toContain('<DemoCompanyDashboard');
    for (const section of ['xd-dashboard-kpis', 'xd-dashboard-primary', 'xd-dashboard-secondary', 'Today', 'Action Required', 'Fleet & Drivers', 'Recent Activity', 'Performance', 'Load Overview']) {
      expect(original).toContain(section);
    }
  });
  it('loads verified fleet and receivables through tenant-authorized backend routes', () => {
    expect(adapter).toContain('/api/workspace/fleet-overview?companyId=');
    expect(adapter).toContain('/api/driver/finance/invoices?view=receivables&limit=500');
    expect(adapter).toContain('readRouteAuthAccessToken');
    expect(adapter).toContain('body?.companyId === companyId');
    expect(adapter).toContain('setVerifiedOutstanding');
    expect(original).toContain('verifiedOutstanding!==undefined');
    expect(original).toContain('verifiedFleet?verifiedFleet.drivers');
  });
  it('does not count completed loads as active or outgoing quotes as received quotes', () => {
    expect(original).toContain('jobs.filter(j=>!["Completed","Cancelled"].includes(j.status)).length');
    expect(original).toContain('q.direction==="Received"');
    expect(original).toContain('workspaceLabel==="Owner Driver"?j.status==="Allocated"');
    expect(adapter).toContain('Assigned driver');
    expect(original).toContain('const recentActivity=real?[...real.data.jobs].sort');
    expect(original).toContain('j.updated_at||j.created_at');
  });
  it('takes jobs, vehicles and drivers only from authenticated workspace data and preserves direct job links', () => {
    expect(adapter).toContain('useCompany3150Live()');
    expect(adapter).toContain('live?.data.jobs ?? []');
    expect(adapter).toContain('live?.data.vehicles ?? []');
    expect(adapter).toContain('live?.data.drivers ?? []');
    expect(adapter).toContain("masterNavigationHref('Owner Driver', index)");
    expect(adapter).toContain('/driver/jobs/${encodeURIComponent(jobId)}');
    expect(original).toContain('onOpenJob?onOpenJob(j.id):go(4)');
    expect(adapter).not.toContain('demoExchange');
  });
});