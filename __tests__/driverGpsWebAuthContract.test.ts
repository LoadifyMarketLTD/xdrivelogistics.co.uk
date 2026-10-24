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
    expect(route).toContain('hasActiveAssignedJob(driver.id)');
  });

  it('preserves native device binding on native mobile routes', () => {
    const native = read('app/api/driver/mobile/_lib.ts');
    expect(native).toContain('enforceActiveNativeDeviceBinding');
    expect(native).toContain('Active native device identity is required.');
  });
});
