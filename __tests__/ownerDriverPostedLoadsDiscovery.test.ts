import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const source = read('app/driver/posted-loads/page.tsx');
const form = read('app/components/workspace/LoadPostingForm.tsx');
const routes = read('lib/roleCapabilities.ts');
const market = read('app/driver/loads/page.tsx');

describe('Owner Driver saved Post Load discoverability and access', () => {
  it('redirects Save Draft and Open Saved Loads into the owned company register', () => {
    expect(form).toContain("onClick={() => void save(false)}");
    expect(form).toContain("mode === 'owner' ? '/driver/posted-loads' : '/admin/jobs'");
    expect(form).toContain("? \`/driver/posted-loads?created=\${payload.job.id}\`");
  });
  it('registers a protected owner-driver-only route with job view capability', () => {
    expect(routes).toContain("{ prefix: '/driver/posted-loads', workspace: 'owner_operator', roles: ['owner_driver'], anyOf: ['jobs.view'] }");
    expect(source).toContain("resolveWorkspaceRole(user) === 'owner_driver'");
    expect(source).toContain("<ProtectedRoute allowedRoles={['driver']}>");
  });
  it('requires canonical Owner Driver and active owner membership before reading exact company-created jobs', () => {
    const endpoint = read('app/api/driver/posted-loads/route.ts');
    expect(source).toContain('const companyId = await resolveActiveCompanyId');
    expect(source).toContain('readRouteAuthHeader()');
    expect(source).toContain("fetch('/api/driver/posted-loads'");
    expect(source).toContain("job.company_id === companyId && job.created_by === user.id");
    expect(endpoint).toContain('requireActiveWebDriver(request)');
    expect(endpoint).toContain("ownerDriver.driver_type !== 'owner_driver'");
    expect(endpoint).toContain("ownerDriver.app_access !== true");
    expect(endpoint).toContain(".from('company_memberships')");
    expect(endpoint).toContain(".eq('role_in_company', 'owner')");
    expect(endpoint).toContain(".eq('status', 'active')");
    expect(endpoint).toContain(".eq('company_id', driver.companyId)");
    expect(endpoint).toContain(".eq('created_by', driver.userId)");
    expect(endpoint).toContain("job.company_id === driver.companyId && job.created_by === driver.userId");
  });
  it('provides draft, other status and search filters without exposing send, publish or invoice buttons', () => {
    expect(source).toContain("aria-label=\"My posted load statuses\"");
    expect(source).toContain("aria-label=\"Search my posted loads\"");
    expect(source).toContain("Private Draft — not published");
    expect(source).not.toContain("submitInvoice(");
    expect(source).not.toContain("postLoad(");
    expect(source).not.toContain("sendEmail(");
    expect(market).toContain("router.push('/driver/posted-loads')");
  });
});