import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver PWA GPS auth boundary', () => {
  it('authenticates the web presence API with the approved web driver identity', () => {
    const route = read('app/api/driver/availability-presence/route.ts');
    expect(route).toContain('requireActiveWebDriver(request)');
    expect(route).toContain(".eq('user_id', context.userId)");
    expect(route).not.toContain('requireDriver(request)');
    expect(route).toContain('ensureAvailabilityEligible(auth.driver, true)');
    expect(route).not.toContain('hasActiveAssignedJob');
    expect(route).not.toContain('Availability sharing is disabled while you have an active assigned job.');
    expect(route).toContain('ensureAvailabilityEligible(auth.driver, true)');
  });

  it('does not gate mobile routes by device identity', () => {
    const native = read('app/api/driver/mobile/_lib.ts');
    expect(native).toContain('supabaseAdmin.auth.getUser(token)');
    expect(native).not.toContain('enforceActiveNativeDeviceBinding');
  });
});
