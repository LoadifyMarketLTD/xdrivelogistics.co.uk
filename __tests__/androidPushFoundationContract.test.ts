import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('XDrive Driver push foundation contract', () => {
  const root = process.cwd();
  const migration = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260826132000_driver_push_devices.sql'),
    'utf8',
  );
  const route = fs.readFileSync(
    path.join(root, 'app/api/driver/push-devices/route.ts'),
    'utf8',
  );
  const serverDeviceSession = fs.readFileSync(
    path.join(root, 'app/api/driver/mobile/device-session/route.ts'),
    'utf8',
  );
  const appConfig = fs.readFileSync(path.join(root, 'apps/driver-mobile/app.config.ts'), 'utf8');
  const packageJson = fs.readFileSync(path.join(root, 'apps/driver-mobile/package.json'), 'utf8');
  const pushRegistration = fs.readFileSync(
    path.join(root, 'apps/driver-mobile/src/push/registerPushToken.ts'),
    'utf8',
  );
  const deviceSession = fs.readFileSync(
    path.join(root, 'apps/driver-mobile/src/auth/deviceSession.ts'),
    'utf8',
  );
  const worker = fs.readFileSync(
    path.join(root, 'supabase/functions/notify-operational-event/index.ts'),
    'utf8',
  );
  const fcm = fs.readFileSync(
    path.join(root, 'supabase/functions/notify-operational-event/fcm.ts'),
    'utf8',
  );

  it('keeps provider tokens server-only and binds delivery to a live auth session', () => {
    expect(migration).toContain('create table if not exists public.driver_push_devices');
    expect(migration).toContain('auth_session_id uuid not null');
    expect(migration).toContain('alter table public.driver_push_devices enable row level security');
    expect(migration).toContain('revoke all on table public.driver_push_devices from anon, authenticated');
    expect(migration).toContain('join auth.sessions s');
    expect(migration).toContain('(s.not_after is null or s.not_after > now())');
  });

  it('registers push only through the device-bound active-driver server boundary', () => {
    expect(route).toContain('supabaseAdmin.auth.getUser(token)');
    expect(route).toContain(".eq('status', 'active')");
    expect(route).toContain('driver.app_access !== true');
    expect(route).toContain('requireActiveBinding');
    expect(route).toContain('auth_session_id: auth.sessionId');
    expect(route).toContain("appPackage !== ANDROID_PACKAGE");
  });

  it('invalidates stale push routing when a newer XDrive device session wins', () => {
    expect(serverDeviceSession).toContain('invalidateStalePushBindings');
    expect(serverDeviceSession).toContain(".from('driver_push_devices')");
    expect(serverDeviceSession).toContain(".eq('installation_id', installationId)");
    expect(serverDeviceSession).toContain(".neq('auth_session_id', authSessionId)");
    expect(serverDeviceSession).toContain(".neq('installation_id', installationId)");
    expect(serverDeviceSession).toContain(".eq('enabled', true)");
    expect(serverDeviceSession).toContain("{ error: 'Mobile push session reconciliation failed.' }");
  });

  it('preserves the current FCM registration across JWT refresh in the same auth session', () => {
    expect(deviceSession).toContain('if (registeredToken === normalizedToken) return installationId');
    expect(serverDeviceSession).toContain(".neq('auth_session_id', authSessionId)");
    expect(serverDeviceSession).not.toContain(".delete()\n    .eq('installation_id', installationId);\n");
  });

  it('uses the native Android provider token from Expo and the canonical push endpoint', () => {
    expect(pushRegistration).toContain('Notifications.getDevicePushTokenAsync()');
    expect(pushRegistration).not.toContain('getExpoPushTokenAsync');
    expect(pushRegistration).toContain("apiRequest('/api/driver/push-devices'");
    expect(pushRegistration).toContain('installation_id: installationId');
    expect(pushRegistration).toContain('app_package: XDRIVE_DRIVER_PACKAGE');
    expect(pushRegistration).toContain('ensureDeviceSession(getApiBaseUrl(), sessionToken)');
  });

  it('declares Android notification permission without background-location permission', () => {
    expect(appConfig).toContain("'POST_NOTIFICATIONS'");
    expect(appConfig).toContain("'ACCESS_FINE_LOCATION'");
    expect(appConfig).toContain("'ACCESS_COARSE_LOCATION'");
    expect(appConfig).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(packageJson).toContain('expo-notifications');
    expect(packageJson).toContain('expo-device');
  });

  it('binds the push identity to the canonical XDrive production package', () => {
    expect(deviceSession).toContain("XDRIVE_DRIVER_PACKAGE = 'co.uk.xdrivelogistics.driver'");
    expect(appConfig).toContain("package: 'co.uk.xdrivelogistics.driver'");
  });

  it('keeps FCM delivery in the canonical operational notification worker', () => {
    expect(worker).toContain("case 'job_assigned': success = await handleJobAssigned(event)");
    expect(worker).toContain("supabase.rpc('active_driver_push_devices_for_user'");
    expect(worker).toContain('sendAssignedJobPush(userId, jobIdRaw)');
    expect(worker).toContain("Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')");
    expect(fcm).toContain('https://www.googleapis.com/auth/firebase.messaging');
    expect(fcm).toContain('UNREGISTERED');
  });

  it('does not expose Firebase server credentials in the mobile client', () => {
    const combined = [appConfig, packageJson, pushRegistration, deviceSession, route].join('\n');
    expect(combined).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(combined).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON');
    expect(combined).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
