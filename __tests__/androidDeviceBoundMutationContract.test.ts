import fs from 'node:fs';
import path from 'node:path';

describe('Android device-bound mutation contract', () => {
  const root = process.cwd();
  const mobileLib = fs.readFileSync(path.join(root, 'app/api/driver/mobile/_lib.ts'), 'utf8');
  const statusRoute = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/[id]/status/route.ts'), 'utf8');
  const evidenceRoute = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/[id]/evidence/route.ts'), 'utf8');
  const confirmationRoute = fs.readFileSync(path.join(root, 'app/api/driver/mobile/jobs/[id]/confirmation/route.ts'), 'utf8');
  const mutationApi = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SecureDriverMutationApi.kt'),
    'utf8',
  );
  const commercialApi = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SecureDriverCommercialApi.kt'),
    'utf8',
  );
  const deviceApi = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/DeviceSessionApi.kt'),
    'utf8',
  );
  const viewModel = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DriverViewModel.kt'),
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
  const quoteWorker = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/QuoteSyncWorker.kt'),
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

  test('online and offline status mutations cross the XDrive device gate', () => {
    expect(viewModel).toContain('mutationApi.updateJobStatus(session, jobId, nextStatus)');
    expect(viewModel).not.toContain('api.updateJobStatus(session, profile.driverId');
    expect(statusWorker).toContain('mutationApi.updateJobStatus(');
    expect(statusWorker).not.toContain('api.updateJobStatus(session, action.driverId');
    expect(statusRoute).toContain('const driver = await requireDriver(request)');
    expect(statusRoute).toContain("scoped.rpc('driver_update_job_status_atomic'");
    expect(mutationApi).toContain('X-XDrive-Installation-Id');
  });

  test('POD replay and recipient confirmation cross the same device gate', () => {
    expect(podWorker).toContain('mutationApi.uploadPodEvidence(');
    expect(podWorker).not.toContain('/storage/v1/object/pod-photos/');
    expect(podWorker).not.toContain('/rest/v1/jobs?');
    expect(viewModel).toContain('mutationApi.confirmDeliveryRecipient(session, selectedJob.id, cleanName)');
    expect(viewModel).not.toContain('api.confirmDeliveryRecipient(');
    expect(evidenceRoute).toContain('const driver = await requireDriver(request)');
    expect(confirmationRoute).toContain('const driver = await requireDriver(request)');
    expect(evidenceRoute).toContain(".from('pod-photos')");
    expect(evidenceRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(confirmationRoute).toContain(".eq('assigned_driver_id', driver.driverId)");
  });

  test('server evidence endpoint preserves deterministic retry and defers delivery linking to final POD', () => {
    expect(evidenceRoute).toContain('upsert: false');
    expect(evidenceRoute).toContain("text.includes('already exists')");
    expect(evidenceRoute).toContain('const storagePath = `${driver.companyId}/${id}/${category}/${objectName}`');
    expect(evidenceRoute).toContain("if (kind === 'collection')");
    expect(evidenceRoute).toContain('collection_photo_url: storagePath');
    expect(evidenceRoute).not.toContain('delivery_photos: Array.from');
    expect(evidenceRoute).not.toContain('pod_photos: Array.from');
    expect(evidenceRoute).toContain(".select('id')");
    expect(evidenceRoute).toContain('.maybeSingle()');
    expect(evidenceRoute).toContain('Collection evidence could not be linked to this assignment.');
  });

  test('revoked device errors are typed and are never refreshed back into service', () => {
    expect(deviceApi).toContain('class DeviceSessionException');
    expect(deviceApi).toContain('This device is no longer authorised for XDrive Driver.');
    expect(mutationApi).toContain('throw DeviceSessionException');
    expect(commercialApi).toContain('throw DeviceSessionException');

    for (const worker of [statusWorker, podWorker, quoteWorker]) {
      expect(worker).toContain('.isDeviceSessionRevoked()');
      expect(worker).toContain('sessionStore.clear(redirectToLogin = false)');
    }
    expect(statusWorker).toContain('if (this.isDeviceSessionRevoked()) return false');
    expect(podWorker).toContain('if (this.isDeviceSessionRevoked()) return false');
    expect(quoteWorker).toContain('if (this.isDeviceSessionRevoked()) return false');
  });
});
