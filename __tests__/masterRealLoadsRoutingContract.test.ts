import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('authenticated Master Loads uses real operational routes', () => {
  it('routes all relevant roles directly instead of mounting DemoExchangeBoard', () => {
    const master = source('app/try-xdrive-demo/components/OperationsDemo.tsx');
    expect(master).toContain("if(authenticated && i===2)");
    expect(master).toContain("role==='Customer'?'/customer/loads':role==='Broker'?'/broker/loads':'/admin/marketplace'");
    expect(master).toContain("if(authenticated && i===0)");
    expect(master).not.toContain("if(authenticated && !preview && i===2)");
  });
  it('Customer loads are backed by the company-scoped operational dataset', () => {
    expect(source('app/customer/loads/page.tsx')).toContain('CustomerLoadsOperationalPage');
    expect(source('app/customer/CustomerOperationalPages.tsx')).toContain('useCompanyWorkspaceData()');
  });
  it('Broker loads use real company jobs and permission context', () => {
    const broker = source('app/broker/loads/page.tsx');
    expect(broker).toContain('useCompanyWorkspaceData()');
    expect(broker).toContain('useAuth()');
  });
  it('Company/Carrier marketplace retrieves live company loads, Driver separately uses driver marketplace API', () => {
    expect(source('app/admin/marketplace/page.tsx')).toContain('CompanyMarketplaceExchange');
    expect(source('app/components/workspace/CompanyMarketplaceExchange.tsx')).toContain('/api/marketplace/company');
    expect(source('app/driver/loads/page.tsx')).toContain('/api/driver/marketplace/loads');
  });
});
