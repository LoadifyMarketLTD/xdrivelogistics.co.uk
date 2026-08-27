import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('XDrive Driver device-bound mutation contract', () => {
  const root = process.cwd();
  const mobileLib = fs.readFileSync(path.join(root, 'app/api/driver/mobile/_lib.ts'), 'utf8');
  const statusRoute = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/[id]/status/route.ts'), 'utf8');
  const evidenceRoute = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/[id]/evidence/route.ts'), 'utf8');
  const confirmationRoute = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/[id]/confirmation/route.ts'), 'utf8');
  const apiClient = fs.readFileSync(path.join(root, 'apps/driver-mobile/src/api/client.ts'), 'utf8');
  const jobsApi = fs.readFileSync(path.join(root, 'apps/driver-mobile/src/api/jobs.ts'), 'utf8');
  const deviceSession = fs.readFileSync(path.join(root, 'apps/driver-mobile/src/auth/deviceSession.ts'), 'utf8');

  test('legacy fallback ends permanently after first mobile registration', () => {
    expect(mobileLib).toContain(".from('driver_mobile_device_sessions')");
    expect(mobileLib).toContain('nativeHistory');
    expect(mobileLib).toContain('if (nativeHistory) return respond(401');
  });

  test('active binding requires installation id and auth session id', () => {
    expect(mobileLib).toContain("request.headers.get('x-xdrive-installation-id')");
    expect(mobileLib).toContain('validatedSessionId(token)');
    expect(mobileLib).toContain('activeBinding.auth_session_id');
    expect(mobileLib).toContain('revoked or replaced by another device');
  });

  test('Expo registers one persistent installation and sends it on authenticated API traffic', () => {
    expect(deviceSession).toContain("INSTALLATION_ID_KEY = 'xdrive.driver.installationId'");
    expect(deviceSession).toContain('SecureStore.getItemAsync');
    expect(deviceSession).toContain('SecureStore.setItemAsync');
    expect(deviceSession).toContain('/api/driver/mobile/device-session');
    expect(apiClient).toContain('ensureDeviceSession(apiBaseUrl, token)');
    expect(apiClient).toContain("'x-xdrive-installation-id': installationId");
  });

  test('status mutations remain server-authoritative behind the XDrive device gate', () => {
    expect(jobsApi).toContain('apiRequest');
    expect(statusRoute).toContain('const driver = await requireDriver(request)');
    expect(statusRoute).toContain("scoped.rpc('driver_update_job_status_atomic'");
  });

  test('POD binary evidence crosses the hardened server boundary rather than direct Supabase storage', () => {
    expect(jobsApi).toContain('apiBinaryRequest');
    expect(jobsApi).toContain(`/api/driver/mobile/jobs/${'${jobId}'}/evidence`);
    expect(jobsApi).toContain("'x-xdrive-evidence-kind': 'delivery'");
    expect(jobsApi).not.toContain("supabase.storage");
    expect(evidenceRoute).toContain('const driver = await requireDriver(request)');
    expect(evidenceRoute).toContain(".from('pod-photos')");
    expect(evidenceRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(evidenceRoute).toContain('hasExpectedMagicBytes');
    expect(evidenceRoute).toContain('MAX_BYTES = 10 * 1024 * 1024');
  });

  test('recipient confirmation remains assignment-scoped on the server', () => {
    expect(confirmationRoute).toContain('const driver = await requireDriver(request)');
    expect(confirmationRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  test('server evidence endpoint preserves deterministic retry and assignment safety', () => {
    expect(evidenceRoute).toContain('upsert: false');
    expect(evidenceRoute).toContain("text.includes('already exists')");
    expect(evidenceRoute).toContain('Array.from(new Set([...deliveryPhotos, storagePath]))');
    expect(evidenceRoute).toContain('Array.from(new Set([...podPhotos, storagePath]))');
    expect(evidenceRoute).toContain('POD evidence could not be linked to this assignment.');
  });
});
