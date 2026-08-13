import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts',
  ),
  'utf8',
);

describe('finance invoice generation authorization contract', () => {
  it('authorizes from active company membership rather than a driver/profile role', () => {
    expect(route).toContain(".from('company_memberships')");
    expect(route).toContain(".eq('status', 'active')");
    expect(route).toContain(".in('role_in_company', ['owner', 'admin', 'finance'])");
    expect(route).not.toContain(".from('drivers')");
    expect(route).not.toContain(".from('profiles')");
  });

  it('preserves Owner Driver finance access without requiring a driver row', () => {
    expect(route).toContain("role === 'owner' || role === 'admin' || role === 'finance'");
    expect(route).not.toContain('driverType');
    expect(route).not.toContain('profile.role');
  });

  it('denies Fleet Driver and dispatcher finance management by excluding those roles', () => {
    expect(route).not.toContain("['owner', 'admin', 'dispatcher', 'finance']");
    expect(route).not.toContain("['owner', 'admin', 'driver', 'finance']");
    expect(route).toContain("['owner', 'admin', 'finance']");
  });

  it('resolves finance authority against the executing carrier company', () => {
    expect(route).toContain('jobScope.awarded_carrier_company_id');
    expect(route).toContain('?? jobScope.assigned_company_id');
    expect(route).toContain('?? jobScope.company_id');
    expect(route).toContain(".eq('company_id', executingCompanyId)");
  });

  it('keeps the invoice job query scoped to the authorised company relationship', () => {
    expect(route).toContain(
      '.or(`company_id.eq.${actor.companyId},assigned_company_id.eq.${actor.companyId},awarded_carrier_company_id.eq.${actor.companyId}`)',
    );
    expect(route).toContain(".eq('supplier_company_id', actor.companyId)");
  });
});
