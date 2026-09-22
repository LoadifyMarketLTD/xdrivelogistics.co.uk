import fs from 'node:fs';
import path from 'node:path';

describe('Driver mobile device-bound server contract', () => {
  const root = process.cwd();
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
  const mobileLib = read('app/api/driver/mobile/_lib.ts');
  const deviceSession = read('app/api/driver/mobile/device-session/route.ts');
  const statusRoute = read('app/api/driver/mobile/jobs/[id]/status/route.ts');
  const evidenceRoute = read('app/api/driver/mobile/jobs/[id]/evidence/route.ts');
  const confirmationRoute = read('app/api/driver/mobile/jobs/[id]/confirmation/route.ts');

  test('legacy fallback ends permanently after first native registration', () => {
    expect(mobileLib).toContain(".from('driver_mobile_device_sessions')");
    expect(mobileLib).toContain('nativeHistory');
    expect(mobileLib).toContain('No active native device session is authorised.');
    expect(mobileLib).toContain('if (nativeHistory) return respond(401');
  });

  test('active binding requires installation id and validated auth session id', () => {
    expect(mobileLib).toContain("request.headers.get('x-xdrive-installation-id')");
    expect(mobileLib).toContain('validatedSessionId(token)');
    expect(mobileLib).toContain('activeBinding.auth_session_id');
    expect(mobileLib).toContain('revoked or replaced by another device');
  });

  test('status, POD evidence and recipient confirmation all cross the same driver gate', () => {
    for (const source of [statusRoute, evidenceRoute, confirmationRoute]) {
      expect(source).toContain('const driver = await requireDriver(request)');
    }
    expect(statusRoute).toContain("scoped.rpc('driver_update_job_status_atomic'");
    expect(evidenceRoute).toContain(".from('pod-photos')");
    expect(evidenceRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(confirmationRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  test('server evidence endpoint preserves deterministic retry and assignment safety', () => {
    expect(evidenceRoute).toContain('upsert: false');
    expect(evidenceRoute).toContain("text.includes('already exists')");
    expect(evidenceRoute).toContain('pickup_photos: [...new Set([...existingPhotos, storagePath])]');
    expect(evidenceRoute).toContain('Collection evidence could not be linked to this assignment.');
  });

  test('device registry accepts only the production package and supports registration, validation and revoke', () => {
    expect(deviceSession).toContain("const ANDROID_PACKAGE = 'co.uk.xdrivelogistics.driver'");
    expect(deviceSession).toContain("rpc('register_driver_mobile_device_session'");
    expect(deviceSession).toContain("request.headers.get('x-xdrive-installation-id')");
    expect(deviceSession).toContain("policy: 'newest_native_login_wins'");
    expect(deviceSession).toContain('export async function DELETE');
    expect(deviceSession).toContain('revoked_at: now');
  });
});
