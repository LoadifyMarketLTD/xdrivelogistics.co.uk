import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const master = source('app/try-xdrive-demo/components/OperationsDemo.tsx');

describe('Master authenticated Network & Tools opens production network records', () => {
  it('navigates per role to company-scoped network implementations', () => {
    expect(master).toContain('if(authenticated && i===9)');
    expect(master).toContain("role==='Customer'?'/customer/network':role==='Broker'?'/broker/carrier-network':'/admin/marketplace/directory'");
  });
  it('routes to existing real network/data sources, without demo endpoints', () => {
    expect(source('app/customer/network/page.tsx')).toContain('useCompanyWorkspaceData');
    expect(source('app/broker/carrier-network/page.tsx')).toContain('BrokerCarrierNetworkPage');
    expect(source('app/admin/marketplace/directory/page.tsx')).toContain('MemberDirectoryPage');
    expect(source('app/components/workspace/MemberDirectoryPage.tsx')).toContain('/api/directory?');
  });
});
