import fs from 'node:fs';
import path from 'node:path';

const webDriver = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/_lib/webDriver.ts'), 'utf8');
const marketplace = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/marketplace/loads/route.ts'), 'utf8');
const advancedSearch = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/search-loads/route.ts'), 'utf8');
const bids = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/bids/route.ts'), 'utf8');
const eligibility = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/bid-eligibility/route.ts'), 'utf8');
const mobile = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/mobile/_lib.ts'), 'utf8');

describe('CX-close Driver web marketplace authentication', () => {
  it('keeps native-device binding on the mobile driver contract', () => {
    expect(mobile).toContain('enforceActiveNativeDeviceBinding');
    expect(mobile).toContain('Active native device identity is required.');
    expect(mobile).toContain('driver_mobile_device_sessions');
  });

  it('uses approved browser driver authentication for desktop marketplace reads, search and quotes', () => {
    expect(webDriver).toContain('export async function requireWebDriver');
    expect(webDriver).not.toContain('driver_mobile_device_sessions');
    expect(marketplace).toContain('requireWebDriver(request)');
    expect(advancedSearch).toContain('requireWebDriver(request)');
    expect(bids).toContain('requireWebDriver(request)');
    expect(eligibility).toContain('requireWebDriver(request)');
  });

  it('preserves driver/profile/app-access and company checks on web', () => {
    for (const contract of [
      ".from('drivers')",
      ".from('profiles')",
      "driverRow.app_access !== true",
      "profileStatus !== 'active'",
      "driverStatus !== 'active'",
      ".from('companies')",
    ]) {
      expect(webDriver).toContain(contract);
    }
  });
});
