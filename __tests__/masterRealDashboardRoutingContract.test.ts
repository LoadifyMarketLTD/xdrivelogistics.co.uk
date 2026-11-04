import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

describe('authenticated Master Dashboard source-of-truth', () => {
  it('renders carrier operational dashboard with verified Supabase datasets', () => {
    const route = read('app/admin/page.tsx');
    const page = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
    expect(route).toContain('dashboard={<CarrierOperationsDashboardHome/>}');
    expect(route).toContain("allowedRoles={['owner','company_admin','company_staff']}");
    expect(page).toContain('useCompanyWorkspaceData()');
    expect(page).toContain('jobsDataset.availability');
    expect(page).toContain('invoicesDataset.availability');
  });
  it('renders broker operational dashboard with real company jobs and quotes', () => {
    const route = read('app/broker/page.tsx');
    const page = read('app/broker/BrokerDashboardHome.tsx');
    expect(route).toContain('dashboard={<BrokerDashboardHome/>}');
    expect(route).toContain("allowedRoles={['broker']}");
    expect(page).toContain('useCompanyWorkspaceData()');
    expect(page).toContain('data.bids');
  });
  it('keeps customer and driver authenticated dashboard sources', () => {
    expect(read('app/customer/page.tsx')).toContain('dashboard={<CustomerDashboardHome />}');
    expect(read('app/driver/page.tsx')).toContain('dashboard={<DriverDashboardContent/>}');
    expect(read('app/try-xdrive-demo/components/OperationsDemo.tsx')).toContain('dashboard&&tab===initialTab?dashboard');
  });
});
