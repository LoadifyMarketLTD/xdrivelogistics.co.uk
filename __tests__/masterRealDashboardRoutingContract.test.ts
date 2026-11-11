import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const approved = read('app/try-xdrive-demo/components/DemoCompanyDashboard.tsx');
const master = read('app/try-xdrive-demo/components/OperationsDemo.tsx');

describe('Master Dashboard: approved 3150 visuals, verified live data', () => {
  it('Carrier and Broker retain approved 3150 dashboard and use verified company datasets', () => {
    for (const route of ['app/admin/page.tsx','app/broker/page.tsx']) {
      const src = read(route);
      expect(src).toContain('Company3150LiveProvider');
      expect(src).toContain('MasterWorkspace');
      expect(src).not.toContain('CarrierOperationsDashboardHome');
      expect(src).not.toContain('BrokerDashboardHome');
    }
    expect(master).toContain('<DemoCompanyDashboard');
    expect(approved).toContain('useCompany3150Live()');
    expect(read('app/try-xdrive-demo/components/Company3150LiveData.tsx')).toContain('useCompanyWorkspaceData()');
  });
  it('Customer uses the same visual and data provider, without a separate old dashboard', () => {
    const customer = read('app/customer/page.tsx');
    expect(customer).toContain('<Company3150LiveProvider>');
    expect(customer).toContain('<MasterWorkspace role="Customer" authenticated dashboard={<');
    expect(customer).toContain('<CompanyMasterDashboard role="Customer"/>');
    expect(customer).toContain('CustomerDashboardHome');
    expect(read('app/customer/CustomerMasterLayoutGate.tsx')).toContain('role="Customer"');
  });
  it('unavailable or incomplete data is not displayed as a verified zero', () => {
    for(const dataset of ['jobs','drivers','invoices','bids']) {
      expect(approved).toContain(`real.data.datasets.${dataset}.availability === 'available'`);
    }
    expect(approved).toContain('metricDisplay(k.label,k.value)');
    expect(approved).toContain("verifiedAction(a.name)?a.n:'Unavailable'");
    expect(approved).toContain('Job data unavailable or incomplete');
    expect(approved).toContain('overdueDeliveries=real&&jobsVerified?real.data.jobs.filter');
  });
  it('keeps Driver separately connected and synchronizes sidebar state on route changes', () => {
    const driver = read('app/driver/page.tsx');
    expect(driver).toContain('dashboard={<DriverDashboardContent/>}');
    expect(master).toContain('useEffect(()=>{setTab(initialTab);setMobileMenuOpen(false);},[initialTab]);');
    expect(master).toContain('if(authenticated && i===0)');
  });
});
