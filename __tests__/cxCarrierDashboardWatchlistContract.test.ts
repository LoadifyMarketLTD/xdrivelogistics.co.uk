import fs from 'node:fs';
import path from 'node:path';

describe('Carrier dashboard supplier watchlist contract', () => {
  const dashboard = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.join(process.cwd(), 'app/api/settings/company-watchlist/route.ts'),
    'utf8',
  );

  it('loads company and fleet watchlist data through a capability-guarded server route', () => {
    expect(route).toContain("anyOf: ['company.manage', 'documents.company.manage', 'fleet.positions.view']");
    expect(route).toContain("from('company_watchlist')");
    expect(route).toContain("from('company_documents')");
    expect(route).toContain('fullyCompliant');
    expect(route).toContain('aboutToExpire');
    expect(route).toContain('updatesNeeded');
  });

  it('renders CX watchlist compliance states without inventing supplier data', () => {
    expect(dashboard).toContain('/api/settings/company-watchlist?companyId=');
    expect(dashboard).toContain('Add Members to My Watchlist');
    expect(dashboard).toContain('Fully Compliant');
    expect(dashboard).toContain('About to Expire');
    expect(dashboard).toContain('Updates Needed');
  });
});
