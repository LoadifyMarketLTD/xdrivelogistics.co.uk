import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const master = read('app/try-xdrive-demo/components/OperationsDemo.tsx');

describe('Master Directory is real, private and unified', () => {
  it('routes authorised users to real Directory pages', () => {
    expect(master).toContain('if(authenticated && i===10)');
    expect(master).toContain("role==='Customer'?'/customer/directory':role==='Broker'?'/broker/directory':'/admin/marketplace/directory'");
    expect(read('app/customer/directory/page.tsx')).toContain('<MemberDirectoryPage />');
    expect(read('app/broker/directory/page.tsx')).toContain('<MemberDirectoryPage />');
    expect(read('app/broker/directory/page.tsx')).toContain("allowedRoles={['broker']}");
    expect(read('app/customer/CustomerMasterLayoutGate.tsx')).toContain('customerMasterTab(pathname)');
    expect(read('lib/masterWorkspaceRouteTab.ts')).toContain('directory:10');
  });
  it('uses authenticated API with server-side verified active member access', () => {
    const component = read('app/components/workspace/MemberDirectoryPage.tsx');
    const api = read('app/api/directory/route.ts');
    expect(component).toContain('/api/directory?');
    expect(api).toContain('getBearerToken(request)');
    expect(api).toContain('An active XDrive member account is required to use Directory.');
    expect(api).toContain('getBlockedCounterpartyCompanyIds');
  });
});
