import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Expo driver mobile device binding contract', () => {
  it('keeps the production package aligned with the backend device-session contract', () => {
    const appConfig = read('apps/driver-mobile/app.config.ts');
    const identity = read('apps/driver-mobile/src/auth/deviceSession.ts');
    const backend = read('app/api/driver/mobile/device-session/route.ts');

    expect(appConfig).toContain("package: 'co.uk.xdrivelogistics.driver'");
    expect(identity).toContain("XDRIVE_DRIVER_PACKAGE = 'co.uk.xdrivelogistics.driver'");
    expect(backend).toContain("const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver'");
  });

  it('registers a persistent installation id before authenticated API calls', () => {
    const identity = read('apps/driver-mobile/src/auth/deviceSession.ts');
    const client = read('apps/driver-mobile/src/api/client.ts');

    expect(identity).toContain("SecureStore.getItemAsync(INSTALLATION_ID_KEY)");
    expect(identity).toContain("/api/driver/mobile/device-session");
    expect(client).toContain('ensureDeviceSession(apiBaseUrl, token)');
    expect(client).toContain("'x-xdrive-installation-id': installationId");
  });

  it('uses the native Android push token and binds it to the same installation', () => {
    const push = read('apps/driver-mobile/src/push/registerPushToken.ts');

    expect(push).toContain('getDevicePushTokenAsync');
    expect(push).not.toContain('getExpoPushTokenAsync');
    expect(push).toContain("/api/driver/push-devices");
    expect(push).toContain('installation_id: installationId');
    expect(push).toContain('app_package: XDRIVE_DRIVER_PACKAGE');
  });
});
