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

  test('mobile job access requires authentication but no device registration', () => {
    expect(mobileLib).toContain('supabaseAdmin.auth.getUser(token)');
    expect(mobileLib).not.toContain('enforceActiveNativeDeviceBinding');
    expect(mobileLib).not.toContain('driver_mobile_device_sessions');
  });

  test('status, POD evidence and recipient confirmation all cross the same driver gate', () => {
    for (const source of [statusRoute, evidenceRoute, confirmationRoute]) {
      expect(source).toContain('const driver = await requireDriver(request)');
    }
    expect(statusRoute).toContain("'accepted'");
    expect(statusRoute).toContain("scoped.rpc('driver_update_job_status_atomic'");
    expect(evidenceRoute).toContain(".from('pod-photos')");
    expect(evidenceRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(confirmationRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  test('server evidence endpoint preserves deterministic retry and assignment safety', () => {
    expect(evidenceRoute).toContain('upsert: false');
    expect(evidenceRoute).toContain("text.includes('already exists')");
    expect(evidenceRoute).toContain('pickup_photos: [...new Set([...existingCollectionPhotos, storagePath])]');
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
