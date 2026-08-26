import fs from 'node:fs';
import path from 'node:path';

describe('known native JWT gate on shared driver APIs', () => {
  const root = process.cwd();
  const authLib = fs.readFileSync(path.join(root, 'app/api/_lib/supabaseAdmin.ts'), 'utf8');
  const locationRoute = fs.readFileSync(path.join(root, 'app/api/driver/location/route.ts'), 'utf8');
  const passwordRoute = fs.readFileSync(path.join(root, 'app/api/driver/password/route.ts'), 'utf8');
  const notesRoute = fs.readFileSync(path.join(root, 'app/api/driver/jobs/[jobId]/notes/route.ts'), 'utf8');

  test('normal web sessions stay compatible when they have no native registry row', () => {
    expect(authLib).toContain("if (!binding) return { allowed: true, knownNative: false }");
    expect(authLib).toContain(".eq('auth_session_id', sessionId)");
  });

  test('a JWT known to the native registry must still be active and unrevoked', () => {
    expect(authLib).toContain('binding.enabled !== true || binding.revoked_at != null');
    expect(authLib).toContain("error: 'This native device session has been revoked.'");
    expect(authLib).toContain("String(binding.user_id) !== userId");
  });

  test.each([
    ['live location', locationRoute],
    ['password changes', passwordRoute],
    ['job notes', notesRoute],
  ])('%s rejects a revoked known-native JWT before mutation', (_label, route) => {
    expect(route).toContain('validateKnownNativeAuthSession');
    expect(route).toContain('if (!nativeGate.allowed)');
    expect(route).toContain("status: nativeGate.error === 'Server auth is not configured.' ? 503 : 401");
  });

  test('location still retains active-job assignment/state checks after native gate', () => {
    expect(locationRoute).toContain('jobRow.assigned_driver_id !== driverRow.id');
    expect(locationRoute).toContain('ACTIVE_JOB_STATUSES.has(statusOf(jobRow))');
    expect(locationRoute).toContain(".from('driver_locations')");
  });
});
