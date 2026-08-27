import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, test } from 'vitest';

describe('Android offline job status queue contract', () => {
  const root = process.cwd();
  const store = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/PendingJobStatusStore.kt'),
    'utf8',
  );
  const worker = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/JobStatusSyncWorker.kt'),
    'utf8',
  );
  const mutationApi = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/SecureDriverMutationApi.kt'),
    'utf8',
  );
  const viewModel = fs.readFileSync(
    path.join(root, 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/DriverViewModel.kt'),
    'utf8',
  );
  const gradle = fs.readFileSync(path.join(root, 'android-native/app/build.gradle.kts'), 'utf8');
  const rpc = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260723201400_driver_native_status_rpc.sql'),
    'utf8',
  );

  test('queue is encrypted and durably committed before background replay', () => {
    expect(store).toContain('EncryptedSharedPreferences.create(');
    expect(store).toContain('AES256_GCM');
    expect(store).toContain('.commit()');
    expect(store).toContain('createdAtEpochMs');
  });

  test('driver can continue locally while pending statuses remain ordered', () => {
    expect(viewModel).toContain('pendingStatusStore.enqueue(');
    expect(viewModel).toContain('pendingStatusStore.optimisticJobs(');
    expect(store).toContain('.sortedBy { it.createdAtEpochMs }');
  });

  test('replay waits for connectivity and retries transient failures', () => {
    expect(gradle).toContain('androidx.work:work-runtime-ktx:2.11.2');
    expect(worker).toContain('NetworkType.CONNECTED');
    expect(worker).toContain('Result.retry()');
    expect(worker).toContain('BackoffPolicy.EXPONENTIAL');
  });

  test('session expiry refreshes before replaying the same device-gated action', () => {
    expect(worker).toContain('api.refreshSession(session)');
    expect(worker).toContain('sessionStore.saveSession(session)');
    expect(worker).toContain('mutationApi.updateJobStatus(session, action.jobId, action.nextStatus)');
  });

  test('status replay must cross the XDrive native device boundary', () => {
    expect(worker).toContain('SecureDriverMutationApi');
    expect(mutationApi).toContain('X-XDrive-Installation-Id');
    expect(mutationApi).toContain('/api/driver/mobile/jobs/$encodedJobId/status');
    expect(worker).not.toContain('api.updateJobStatus(session, action.driverId, action.jobId, action.nextStatus)');
  });

  test('terminal rejection drops later actions for that job instead of skipping lifecycle', () => {
    expect(worker).toContain('pendingStore.failJob(');
    expect(store).toContain('filterNot { it.userId == userId && it.jobId == jobId }');
    expect(worker).toContain('XDrive status sync needs attention');
  });

  test('server RPC makes same-status replay idempotent and rejects skipped transitions', () => {
    expect(rpc).toContain('IF v_next_status = v_current_status THEN');
    expect(rpc).toContain("RAISE EXCEPTION 'Invalid driver status transition: % -> %'");
  });

  test('status queue is scoped to lifecycle updates only', () => {
    expect(worker).toContain('mutationApi.updateJobStatus(');
    expect(worker).not.toContain('uploadPodEvidence');
    expect(worker).not.toContain('submitJobQuote');
  });
});
