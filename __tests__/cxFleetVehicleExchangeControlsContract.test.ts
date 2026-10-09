import fs from 'node:fs';
import path from 'node:path';

describe('CX-style Fleet vehicle exchange controls contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/admin/fleet/resources/page.tsx'), 'utf8');
  const dataHook = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/useCompanyWorkspaceData.ts'), 'utf8');
  const notifyRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/vehicles/[id]/tracking-preferences/route.ts'), 'utf8');
  const advertisingRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/vehicles/[id]/advertising/route.ts'), 'utf8');

  it('exposes advertising and notify-when-tracked controls from the Company Vehicles register', () => {
    expect(page).toContain("'Advertising', 'Notify when tracked'");
    expect(page).toContain('updateVehicleAdvertising(vehicle.id');
    expect(page).toContain('updateNotifyWhenTracked(vehicle.id');
    expect(page).toContain("<option value=\"exchange\">Exchange</option>");
    expect(page).toContain('checked={vehicle.notify_when_tracked === true}');
  });

  it('loads the real notify_when_tracked field from the vehicle record', () => {
    expect(dataHook).toContain('notify_when_tracked?: boolean | null');
    expect(dataHook).toContain('has_tail_lift, notify_when_tracked, assigned_driver_id');
  });

  it('keeps advertising on the existing audited RPC boundary', () => {
    expect(advertisingRoute).toContain("client.rpc('set_vehicle_advertising_state'");
    expect(page).toContain('/advertising`');
    expect(page).toContain("reason: 'Updated from Fleet resources'");
  });

  it('keeps tracking-notification changes company-scoped and Fleet-operator-only', () => {
    expect(notifyRoute).toContain("requireCompanyCapability(request, parsed.data.companyId, 'vehicles.manage')");
    expect(notifyRoute).toContain(".eq('company_id', operator.companyId)");
    expect(notifyRoute).toContain('notify_when_tracked: parsed.data.notifyWhenTracked');
  });
});
