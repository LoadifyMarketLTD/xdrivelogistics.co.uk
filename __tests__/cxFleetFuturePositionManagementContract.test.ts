import fs from 'node:fs';
import path from 'node:path';

describe('CX-style Fleet future-position management contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/drivers/[id]/future-position/route.ts'), 'utf8');
  const auth = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/_lib/requireCompanyFleetOperator.ts'), 'utf8');

  it('exposes Future Position, Return Journey and Track actions from the consolidated fleet row', () => {
    expect(page).toContain('>Future Position</ActionButton>');
    expect(page).toContain('>Return Journey</ActionButton>');
    expect(page).toContain('>Track</ActionButton>');
    expect(page).toContain('title="Future Position"');
    expect(page).toContain('Publish / Update');
  });

  it('uses a dedicated authenticated admin endpoint rather than impersonating the Driver endpoint', () => {
    expect(page).toContain('/api/admin/drivers/${encodeURIComponent(futureDriverId)}/future-position');
    expect(route).toContain('requireCompanyFleetOperator(request, parsed.data.companyId)');
    expect(route).not.toContain('requireActiveWebDriver');
  });

  it('keeps future-position writes company-scoped and active-driver-only', () => {
    expect(route).toContain(".eq('company_id', operator.companyId)");
    expect(route).toContain("String(driver.status ?? '').trim().toLowerCase() !== 'active'");
    expect(route).toContain(".eq('status', 'active')");
    expect(route).toContain('future_position: position');
    expect(route).toContain('future_position_date: futureDate');
  });

  it('authorises only the existing Fleet operator membership roles', () => {
    expect(auth).toContain("const FLEET_OPERATOR_ROLES = ['owner', 'admin', 'fleet_manager', 'dispatcher'] as const;");
  });
});
