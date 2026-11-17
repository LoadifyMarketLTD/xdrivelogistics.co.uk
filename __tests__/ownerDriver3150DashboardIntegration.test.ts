import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (name: string) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
const page = read('app/driver/page.tsx');
const adapter = read('app/driver/_components/OwnerDriver3150LiveDashboard.tsx');
const original = read('app/try-xdrive-demo/components/DemoCompanyDashboard.tsx');
describe('Owner Driver Dashboard live operational data with legacy 3150 adapter preserved', () => {
  it('renders the current PR807 Driver operational workspace without an embedded demo dashboard', () => {
    expect(page).toContain("const ownerDriver = workspaceRole === 'owner_driver'");
    expect(page).toContain('<DriverWorkspaceShell');
    expect(page).toContain('useCompanyWorkspaceData');
    expect(page).toContain('readRouteAuthAccessToken');
    expect(page).toContain("router.push('/driver/jobs')");
    expect(page).not.toContain('<DemoCompanyDashboard');
    // The retained legacy adapter is verified separately, but it is not the current entrypoint.
    expect(adapter).toContain('<DemoCompanyDashboard');
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
    expect(original).toContain('const pending=jobs.filter(j=>!j.driver&&j.status==="Allocated"');
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