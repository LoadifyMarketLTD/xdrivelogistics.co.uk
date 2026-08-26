import fs from 'node:fs';
import path from 'node:path';

describe('Android device-bound mutation contract', () => {
  const root = process.cwd();
  const mobileLib = fs.readFileSync(path.join(root, 'app/api/driver/mobile/_lib.ts'), 'utf8');
  const statusRoute = fs.readFileSync(
    path.join(root, 'app/api/driver/mobile/jobs/[id]/status/route.ts'),
    'utf8',
  );
  const evidenceRoute = fs.readFileSync(
    path.join(root, 'app/api/driver/mobile/jobs/[id]/evidence/route.ts'),
    'utf8',
  );
  const mutationApi = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SecureDriverMutationApi.kt'),
    'utf8',
  );
  const statusWorker = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/JobStatusSyncWorker.kt'),
    'utf8',
  );
  const podWorker = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/PodSyncWorker.kt'),
    'utf8',
  );

  test('legacy fallback ends permanently after first native registration', () => {
    expect(mobileLib).toContain(".from('driver_mobile_device_sessions')");
    expect(mobileLib).toContain('nativeHistory');
    expect(mobileLib).toContain("No active native device session is authorised.");
    expect(mobileLib).toContain('if (nativeHistory) return respond(401');
  });

  test('active binding requires installation id and auth session id', () => {
    expect(mobileLib).toContain("request.headers.get('x-xdrive-installation-id')");
    expect(mobileLib).toContain('validatedSessionId(token)');
    expect(mobileLib).toContain('activeBinding.auth_session_id');
    expect(mobileLib).toContain('revoked or replaced by another device');
  });

  test('offline status replay no longer mutates Supabase directly', () => {
    expect(statusWorker).toContain('mutationApi.updateJobStatus(');
    expect(statusWorker).not.toContain('api.updateJobStatus(session, action.driverId');
    expect(statusRoute).toContain('const driver = await requireDriver(request)');
    expect(statusRoute).toContain("scoped.rpc('driver_update_job_status_atomic'");
    expect(mutationApi).toContain('X-XDrive-Installation-Id');
  });

  test('offline POD replay no longer uploads or patches Supabase directly', () => {
    expect(podWorker).toContain('mutationApi.uploadPodEvidence(');
    expect(podWorker).not.toContain('/storage/v1/object/pod-photos/');
    expect(podWorker).not.toContain('/rest/v1/jobs?');
    expect(evidenceRoute).toContain('const driver = await requireDriver(request)');
    expect(evidenceRoute).toContain(".from('pod-photos')");
    expect(evidenceRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  test('server evidence endpoint preserves deterministic retry semantics', () => {
    expect(evidenceRoute).toContain("upsert: false");
    expect(evidenceRoute).toContain("text.includes('already exists')");
    expect(evidenceRoute).toContain('Array.from(new Set([...deliveryPhotos, storagePath]))');
    expect(evidenceRoute).toContain('Array.from(new Set([...podPhotos, storagePath]))');
  });
});
