import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, test } from 'vitest';

describe('Android native E2E security hardening', () => {
  const root = process.cwd();
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

  test('foreground tracking fails closed when native device binding is revoked', () => {
    const service = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/TrackingService.kt');
    expect(service).toContain('isDeviceSessionRevoked');
    expect(service).toContain('stopForRevokedDevice()');
    expect(service).toContain('sessionStore.clear(redirectToLogin = false)');
    expect(service).toContain('pendingStore.clear()');
    expect(service).toContain('if (this.isDeviceSessionRevoked()) return false');
  });

  test('tracking state and availability requests carry the native installation id', () => {
    const tracking = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/TrackingStateApi.kt');
    const availability = read('android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/AvailabilityPresenceApi.kt');
    for (const source of [tracking, availability]) {
      expect(source).toContain('X-XDrive-Installation-Id');
      expect(source).toContain('DeviceSessionException');
    }
  });

  test('push registration requires the exact active native binding', () => {
    const push = read('app/api/driver/push-devices/route.ts');
    expect(push).toContain(".from('driver_mobile_device_sessions')");
    expect(push).toContain(".eq('auth_session_id', sessionId)");
    expect(push).toContain(".eq('installation_id', installationId)");
    expect(push).toContain(".eq('enabled', true)");
    expect(push).toContain(".is('revoked_at', null)");
    expect(push).toContain(".eq('auth_session_id', auth.sessionId)");
  });

  test('shared web/native routes reject only known revoked native sessions', () => {
    const gate = read('app/api/driver/mobile/_deviceSessionGate.ts');
    const password = read('app/api/driver/password/route.ts');
    const notes = read('app/api/driver/jobs/[jobId]/notes/route.ts');
    expect(gate).toContain('rejectRevokedNativeAuthSession');
    expect(gate).toContain('if (!binding) return null');
    expect(password).toContain('rejectRevokedNativeAuthSession');
    expect(notes).toContain('rejectRevokedNativeAuthSession');
  });

  test('new POD confirmation is a job-bound typed-name attestation', () => {
    const confirmation = read('app/api/driver/mobile/jobs/[id]/confirmation/route.ts');
    expect(confirmation).toContain("type: 'recipient_typed_name_attestation'");
    expect(confirmation).toContain("signature_method: 'typed_name_attestation'");
    expect(confirmation).toContain('evidence_path: evidencePath');
    expect(confirmation).toContain('job_id: id');
    expect(confirmation).toContain('driver_id: driver.driverId');
    expect(confirmation).toContain('expectedPrefix');
  });

  test('delivered transition preserves structured signature JSON and binds evidence to this job', () => {
    const migration = read('supabase/migrations/20260827052500_preserve_driver_pod_signature_json.sql');
    expect(migration).toContain('v_effective_signature jsonb');
    expect(migration).toContain('delivery_signature_data = coalesce(v_effective_signature');
    expect(migration).toContain("v_effective_signature ->> 'evidence_path'");
    expect(migration).toContain('Recipient signature evidence does not belong to this job.');
    expect(migration).not.toContain("v_job.delivery_signature_data #>> '{}'");
  });
});
