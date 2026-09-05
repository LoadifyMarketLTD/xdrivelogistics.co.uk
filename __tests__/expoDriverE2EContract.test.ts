import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const config = read('apps/driver-mobile/app.config.ts');
const packageJson = read('apps/driver-mobile/package.json');
const tracking = read('apps/driver-mobile/src/tracking/locationTracking.ts');
const push = read('apps/driver-mobile/src/push/registerPushToken.ts');
const pushNavigation = read('apps/driver-mobile/src/push/notificationHandling.ts');
const queue = read('apps/driver-mobile/src/offline/queue.ts');
const jobsApi = read('apps/driver-mobile/src/api/jobs.ts');
const liveLoadsApi = read('apps/driver-mobile/src/api/liveLoads.ts');
const liveLoadsScreen = read('apps/driver-mobile/src/live-loads/LiveLoadsScreen.tsx');
const serverLocation = read('app/api/driver/location/route.ts');

describe('Expo Driver production/E2E source contract', () => {
  it('restores the historical production Expo identity without preview ownership', () => {
    expect(config).toContain("name: 'XDrive Driver'");
    expect(config).toContain("slug: 'xdrive-driver'");
    expect(config).toContain("bundleIdentifier: 'co.uk.xdrivelogistics.driver'");
    expect(config).toContain("package: 'co.uk.xdrivelogistics.driver'");
    expect(config).toContain("productionOwner: 'driver-mobile'");
    expect(config).not.toContain('co.uk.xdrivelogistics.driver.preview');
    expect(config).not.toContain("productionOwner: 'android-native'");
  });

  it('declares the Expo SDK 53 location runtime and native permissions required by the tracking design', () => {
    expect(packageJson).toContain('"expo-location": "~18.1.6"');
    expect(packageJson).toContain('"expo-task-manager": "~13.1.6"');
    expect(config).toContain("'ACCESS_BACKGROUND_LOCATION'");
    expect(config).toContain("'FOREGROUND_SERVICE_LOCATION'");
    expect(config).toContain("'expo-location'");
    expect(config).toContain('isAndroidBackgroundLocationEnabled: true');
    expect(config).toContain('isAndroidForegroundServiceEnabled: true');
  });

  it('publishes only exact active-job live locations through the canonical device-bound backend route', () => {
    expect(tracking).toContain("export const DRIVER_LOCATION_TASK = 'xdrive-driver-live-location'");
    expect(tracking).toContain('TaskManager.defineTask');
    expect(tracking).toContain("await apiRequest('/api/driver/location'");
    expect(tracking).toContain('job_id: jobId');
    expect(tracking).toContain('trackable.length === 1');
    expect(tracking).toContain("[401, 403, 409].includes(error.status)");
    expect(tracking).toContain("await stopAllTracking('signed-out')");
    expect(tracking).not.toContain('enqueueAction');
    expect(serverLocation).toContain("const requestedJobId = typeof body.job_id === 'string'");
    expect(serverLocation).toContain('requireActiveNativeAuthSession');
  });

  it('uses provider-native Android push tokens and the server-owned device registry', () => {
    expect(push).toContain('Notifications.getDevicePushTokenAsync()');
    expect(push).toContain("apiRequest('/api/driver/push-devices'");
    expect(push).toContain('installation_id: installationId');
    expect(push).toContain('app_package: XDRIVE_DRIVER_PACKAGE');
    expect(push).not.toContain('getExpoPushTokenAsync');
    expect(pushNavigation).toContain('Notifications.addNotificationResponseReceivedListener');
    expect(pushNavigation).toContain('data.job_id');
    expect(pushNavigation).toContain('xdrive:\\/\\/job\\/');
  });

  it('keeps quote and multi-drop replay inside the account-scoped durable queue', () => {
    expect(queue).toContain('queueStorageKey(userId)');
    expect(queue).toContain("action.endpoint === 'quote'");
    expect(queue).toContain("action.endpoint === 'stop-status'");
    expect(jobsApi).toContain('postQueuedStopStatus');
    expect(liveLoadsApi).toContain('submitQueuedLiveLoadQuote');
    expect(liveLoadsScreen).toContain("endpoint: 'quote'");
    expect(liveLoadsScreen).toContain('Quote saved offline');
  });

  it('does not weaken POD and collection evidence requirements while hardening offline behaviour', () => {
    expect(jobsApi).toContain('A collection photo is required before Loaded can be confirmed.');
    expect(jobsApi).toContain('Collection evidence must be a JPEG or PNG photo.');
    expect(jobsApi).toContain('A maximum of 10 POD and damage photos');
    expect(jobsApi).toContain('A maximum of 10 POD documents');
  });
});
