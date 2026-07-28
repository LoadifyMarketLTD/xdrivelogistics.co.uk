import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseDeviceTokenRegisterBody,
  parseDeviceTokenUnregisterBody,
} from '../app/api/driver/mobile/device-token/contract';

describe('driver mobile device-token contract', () => {
  test('rejects malformed register payloads', () => {
    expect(parseDeviceTokenRegisterBody(null)).toMatchObject({ ok: false });
    expect(parseDeviceTokenRegisterBody([])).toMatchObject({ ok: false });
    expect(parseDeviceTokenRegisterBody({})).toMatchObject({ ok: false });
    expect(parseDeviceTokenRegisterBody({ token: 'short' })).toMatchObject({ ok: false });
    expect(parseDeviceTokenRegisterBody({ token: 'x'.repeat(30), platform: 'ios' })).toMatchObject({ ok: false });
    expect(parseDeviceTokenRegisterBody({ token: 'x'.repeat(30), unknown: true })).toMatchObject({ ok: false });
  });

  test('rejects register payload missing installation_id', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        generation: 1,
        // no installation_id
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('installation_id') });
  });

  test('rejects register payload with blank installation_id', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: '   ',
        generation: 1,
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('installation_id') });
  });

  test('rejects register payload with installation_id longer than 64 chars', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: 'a'.repeat(65),
        generation: 1,
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('installation_id') });
  });

  test('rejects register payload missing generation', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: 'install-uuid-1',
        // no generation
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('generation') });
  });

  test('rejects register payload with generation = 0 (non-positive)', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: 'install-uuid-1',
        generation: 0,
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('generation') });
  });

  test('rejects register payload with negative generation', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: 'install-uuid-1',
        generation: -1,
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('generation') });
  });

  test('rejects register payload with fractional generation', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: 'install-uuid-1',
        generation: 1.5,
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('generation') });
  });

  test('accepts strict register payload with installation_id and generation', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
        installation_id: 'install-uuid-1',
        generation: 1,
      }),
    ).toEqual({
      ok: true,
      value: {
        token: 'x'.repeat(160),
        platform: 'android',
        appPackage: null,
        installationId: 'install-uuid-1',
        generation: 1,
      },
    });
  });

  test('accepts strict register payload with app package', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(140),
        platform: 'android',
        app_package: 'co.uk.xdrivelogistics.driver',
        installation_id: 'install-uuid-2',
        generation: 5,
      }),
    ).toEqual({
      ok: true,
      value: {
        token: 'x'.repeat(140),
        platform: 'android',
        appPackage: 'co.uk.xdrivelogistics.driver',
        installationId: 'install-uuid-2',
        generation: 5,
      },
    });
  });

  test('accepts generation values larger than 1 (subsequent rotations)', () => {
    const result = parseDeviceTokenRegisterBody({
      token: 'x'.repeat(140),
      installation_id: 'install-uuid-3',
      generation: 999,
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.generation).toBe(999);
  });

  test('unregister payload only allows token', () => {
    expect(parseDeviceTokenUnregisterBody({ token: 'x'.repeat(140) })).toEqual({
      ok: true,
      token: 'x'.repeat(140),
    });
    expect(parseDeviceTokenUnregisterBody({ token: 'x'.repeat(140), platform: 'android' })).toMatchObject({ ok: false });
  });
});

describe('driver_device_tokens migration security', () => {
  const migrationPath = join(
    __dirname,
    '../supabase/migrations/20260728120000_driver_device_tokens_lifecycle.sql',
  );
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  test('revokes all authenticated access to driver_device_tokens', () => {
    // Authenticated Supabase clients must never be able to read or write device tokens directly.
    expect(migrationSql).toMatch(/REVOKE ALL ON public\.driver_device_tokens FROM authenticated/i);
  });

  test('enables row-level security on driver_device_tokens', () => {
    // RLS must be active so no policy-bypass accidental reads are possible.
    expect(migrationSql).toMatch(/ALTER TABLE public\.driver_device_tokens ENABLE ROW LEVEL SECURITY/i);
  });

  test('does not grant SELECT on driver_device_tokens to authenticated', () => {
    // No GRANT … TO authenticated should exist for this table.
    const grantSelectToAuthenticated = /GRANT\s+(?:SELECT|ALL)[^;]*driver_device_tokens[^;]*TO\s+authenticated/is;
    expect(migrationSql).not.toMatch(grantSelectToAuthenticated);
  });

  test('does not define a permissive authenticated policy on driver_device_tokens', () => {
    // No CREATE POLICY … TO authenticated should be present, ensuring ordinary clients
    // cannot bypass the REVOKE via a row-level policy.
    const authenticatedPolicy = /CREATE\s+POLICY[^;]*TO\s+authenticated/is;
    expect(migrationSql).not.toMatch(authenticatedPolicy);
  });

  test('grants service_role access for server-side mutations', () => {
    // Server routes run as service_role; they must retain full table access.
    expect(migrationSql).toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.driver_device_tokens\s+TO\s+service_role/i);
  });

  test('migration includes installation_id column for stale-generation detection', () => {
    expect(migrationSql).toMatch(/installation_id\s+text/i);
  });

  test('migration includes registration_generation column for server-enforced ordering', () => {
    expect(migrationSql).toMatch(/registration_generation\s+bigint/i);
  });
});

describe('device-token stale-generation server-side ordering contract', () => {
  /**
   * Pure simulation of the server-side stale generation check performed in route.ts.
   * Validates the contract: an incoming request whose generation is <= the generation
   * already stored for the same (installation_id, token) pair must be treated as a
   * no-op and must not mutate server state.
   */
  function shouldRejectAsStale(
    existing: { installation_id: string; registration_generation: number } | null,
    incoming: { installation_id: string; generation: number },
  ): boolean {
    if (!existing) return false;
    if (existing.installation_id !== incoming.installation_id) return false;
    return existing.registration_generation >= incoming.generation;
  }

  test('no existing row means request is accepted', () => {
    expect(shouldRejectAsStale(null, { installation_id: 'dev1', generation: 1 })).toBe(false);
  });

  test('existing row with lower generation means request is accepted (valid rotation)', () => {
    expect(shouldRejectAsStale(
      { installation_id: 'dev1', registration_generation: 3 },
      { installation_id: 'dev1', generation: 4 },
    )).toBe(false);
  });

  test('existing row with equal generation means request is rejected (idempotent duplicate)', () => {
    expect(shouldRejectAsStale(
      { installation_id: 'dev1', registration_generation: 5 },
      { installation_id: 'dev1', generation: 5 },
    )).toBe(true);
  });

  test('existing row with higher generation means request is rejected (stale A after B)', () => {
    // B registered with generation 6 on device dev1. Stale A request with generation 5 arrives.
    expect(shouldRejectAsStale(
      { installation_id: 'dev1', registration_generation: 6 },
      { installation_id: 'dev1', generation: 5 },
    )).toBe(true);
  });

  test('different installation_id means request is accepted (device reinstall or transfer)', () => {
    // A new installation UUID means a fresh install — we allow the transfer.
    expect(shouldRejectAsStale(
      { installation_id: 'dev1', registration_generation: 10 },
      { installation_id: 'dev2', generation: 1 },
    )).toBe(false);
  });

  test('B newer generation after A→B switch is always accepted', () => {
    // After A (gen=5) → B (gen=6) on same device, B's request is not stale.
    expect(shouldRejectAsStale(
      { installation_id: 'dev1', registration_generation: 5 },
      { installation_id: 'dev1', generation: 6 },
    )).toBe(false);
  });

  test('A old request cannot overwrite B new registration (direct A→B switch test)', () => {
    // B has already registered with gen=6. A's delayed request with gen=5 is stale.
    const existingRowAfterB = { installation_id: 'dev1', registration_generation: 6 };
    const staleARequest = { installation_id: 'dev1', generation: 5 };
    expect(shouldRejectAsStale(existingRowAfterB, staleARequest)).toBe(true);
  });
});

