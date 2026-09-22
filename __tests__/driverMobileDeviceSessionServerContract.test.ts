import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile device-session server contract', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
  const server = read('app/api/driver/mobile/device-session/route.ts');
  const mobileAuth = read('app/api/driver/mobile/_lib.ts');

  it('registers only the production Android package against the server registry', () => {
    expect(server).toContain("const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver'");
    expect(server).toContain("rpc('register_driver_mobile_device_session'");
    expect(server).toContain('p_app_package: ANDROID_PACKAGE');
  });

  it('binds registration to a validated Supabase auth session id', () => {
    expect(server).toContain('sessionIdAfterValidation(token)');
    expect(server).toContain('p_auth_session_id: auth.sessionId');
    expect(server).toContain("policy: 'newest_native_login_wins'");
  });

  it('validates and revokes the same installation/session tuple', () => {
    expect(server).toContain("request.headers.get('x-xdrive-installation-id')");
    expect(server).toContain(".eq('auth_session_id', auth.sessionId)");
    expect(server).toContain('export async function DELETE');
    expect(server).toContain('revoked_at: now');
  });

  it('enforces the active binding on protected mobile APIs', () => {
    expect(mobileAuth).toContain('enforceActiveNativeDeviceBinding');
    expect(mobileAuth).toContain('No active native device session is authorised.');
    expect(mobileAuth).toContain('This mobile session has been revoked or replaced by another device.');
  });
});
