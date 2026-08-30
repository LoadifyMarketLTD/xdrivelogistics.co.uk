import fs from 'node:fs';
import path from 'node:path';

describe('Expo Driver device-session contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const client = read('apps/driver-mobile/src/api/client.ts');
  const deviceSession = read('apps/driver-mobile/src/auth/deviceSession.ts');
  const cleanup = read('apps/driver-mobile/src/auth/serverSessionCleanup.ts');
  const supabase = read('apps/driver-mobile/src/auth/supabase.ts');
  const server = read('app/api/driver/mobile/device-session/route.ts');

  it('uses one stable installation identity for authenticated JSON and binary requests', () => {
    expect(deviceSession).toContain("const INSTALLATION_ID_KEY = 'xdrive.driver.installationId'");
    expect(deviceSession).toContain('SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY');
    expect(client).toContain('await ensureDeviceSession(apiBaseUrl, token)');
    expect(client).toContain("'x-xdrive-installation-id': installationId");
    expect(client).toContain('export async function apiBinaryRequest');
  });

  it('registers only the canonical Expo package against the server registry', () => {
    expect(deviceSession).toContain("XDRIVE_DRIVER_PACKAGE = 'co.uk.xdrivelogistics.driver'");
    expect(deviceSession).toContain("'/api/driver/mobile/device-session'");
    expect(server).toContain("const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver'");
    expect(server).toContain("rpc('register_driver_mobile_device_session'");
  });

  it('revokes the server device binding before clearing explicit local auth', () => {
    expect(cleanup).toContain('await revokeDeviceSession(getApiBaseUrl(), token).catch(() => undefined)');
    const cleanupCall = supabase.indexOf('await cleanupDriverServerSession(accessToken)');
    const localSignOut = supabase.indexOf('return await activeClient.auth.signOut()', cleanupCall);
    expect(cleanupCall).toBeGreaterThan(-1);
    expect(localSignOut).toBeGreaterThan(cleanupCall);
  });

  it('keeps logout available if best-effort server cleanup cannot be reached', () => {
    expect(supabase).toContain('Explicit logout must still clear local auth if remote cleanup is unavailable.');
    expect(cleanup).toContain('.catch(() => undefined)');
  });
});
