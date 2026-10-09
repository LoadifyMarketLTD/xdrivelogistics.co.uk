import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Fleet tracking preferences contract', () => {
  const page = read('app/admin/fleet/resources/page.tsx');
  const hook = read('app/components/workspace/useCompanyWorkspaceData.ts');
  const route = read('app/api/admin/vehicles/[id]/tracking-preferences/route.ts');

  it('loads the real notify_when_tracked field and exposes it in Fleet Resources', () => {
    expect(hook).toContain('notify_when_tracked?: boolean | null');
    expect(hook).toContain('notify_when_tracked, assigned_driver_id');
    expect(page).toContain('Notify when tracked');
    expect(page).toContain('updateNotifyWhenTracked');
  });

  it('keeps preference changes company-scoped and Fleet-operator-only', () => {
    expect(route).toContain("requireCompanyCapability(request, parsed.data.companyId, 'vehicles.manage')");
    expect(route).toContain(".eq('company_id', operator.companyId)");
    expect(route).toContain('notify_when_tracked: parsed.data.notifyWhenTracked');
  });
});
