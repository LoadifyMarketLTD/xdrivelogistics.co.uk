import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Expo driver operational bridge contract', () => {
  it('keeps authenticated requests device-bound', () => {
    const client = read('apps/driver-mobile/src/api/client.ts');
    const deviceSession = read('apps/driver-mobile/src/auth/deviceSession.ts');

    expect(client).toContain("'x-xdrive-installation-id': installationId");
    expect(client).toContain('ensureDeviceSession');
    expect(deviceSession).toContain('/api/driver/mobile/device-session');
    expect(deviceSession).toContain("co.uk.xdrivelogistics.driver");
  });

  it('uses the hardened POD evidence path instead of direct client storage writes', () => {
    const jobs = read('apps/driver-mobile/src/api/jobs.ts');

    expect(jobs).toContain('/api/driver/mobile/jobs/${jobId}/evidence');
    expect(jobs).toContain('apiBinaryRequest');
    expect(jobs).toContain("'x-xdrive-evidence-kind': 'delivery'");
  });

  it('uses the session-bound push registry', () => {
    const push = read('apps/driver-mobile/src/push/registerPushToken.ts');

    expect(push).toContain('getDevicePushTokenAsync');
    expect(push).toContain('/api/driver/push-devices');
    expect(push).toContain('installation_id: installationId');
    expect(push).toContain('app_package: XDRIVE_DRIVER_PACKAGE');
  });

  it('exposes the current backend contracts for tracking, availability and return journey', () => {
    const operations = read('apps/driver-mobile/src/api/operations.ts');

    expect(operations).toContain('/api/driver/tracking-state');
    expect(operations).toContain('/api/driver/location');
    expect(operations).toContain('/api/driver/availability-presence');
    expect(operations).toContain('/api/driver/return-journey');
  });

  it('stops active tracking before explicit logout revokes the bound device session', () => {
    const cleanup = read('apps/driver-mobile/src/auth/serverSessionCleanup.ts');
    const stopTrackingIndex = cleanup.indexOf('stopOperationalTracking');
    const unregisterPushIndex = cleanup.indexOf('unregisterPushDevice(token)');
    const revokeDeviceIndex = cleanup.indexOf('revokeDeviceSession(getApiBaseUrl(), token)');

    expect(stopTrackingIndex).toBeGreaterThan(-1);
    expect(unregisterPushIndex).toBeGreaterThan(stopTrackingIndex);
    expect(revokeDeviceIndex).toBeGreaterThan(unregisterPushIndex);
  });
});
