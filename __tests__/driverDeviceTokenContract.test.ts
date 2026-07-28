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

  test('unregister payload requires token installation_id and generation', () => {
    expect(parseDeviceTokenUnregisterBody({
      token: 'x'.repeat(140),
      installation_id: 'install-uuid-u1',
      generation: 7,
    })).toEqual({
      ok: true,
      token: 'x'.repeat(140),
      installationId: 'install-uuid-u1',
      generation: 7,
    });
    expect(parseDeviceTokenUnregisterBody({ token: 'x'.repeat(140), platform: 'android' })).toMatchObject({ ok: false });
    expect(parseDeviceTokenUnregisterBody({ token: 'x'.repeat(140) })).toMatchObject({ ok: false });
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

  test('migration defines atomic register RPC', () => {
    expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.driver_register_device_token_atomic\(/i);
    expect(migrationSql).toMatch(/RETURNS text/i);
  });

  test('migration defines atomic unregister RPC', () => {
    expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.driver_unregister_device_token_atomic\(/i);
  });

  test('atomic register RPC serializes competing writes with advisory locks', () => {
    expect(migrationSql).toMatch(/pg_advisory_xact_lock\(hashtext\('driver_device_tokens:install:'/i);
    expect(migrationSql).toMatch(/pg_advisory_xact_lock\(hashtext\('driver_device_tokens:token:'/i);
  });

  test('atomic register RPC compares generation at installation scope', () => {
    expect(migrationSql).toMatch(/WHERE installation_id = p_installation_id[\s\S]*ORDER BY registration_generation DESC/i);
    expect(migrationSql).toMatch(/IF p_generation < v_current\.registration_generation THEN[\s\S]*RETURN 'stale'/i);
    expect(migrationSql).toMatch(/IF p_generation = v_current\.registration_generation THEN[\s\S]*RETURN 'duplicate'[\s\S]*RETURN 'stale'/i);
  });

  test('atomic register RPC performs upsert and legacy driver sync in one function', () => {
    expect(migrationSql).toMatch(/INSERT INTO public\.driver_device_tokens[\s\S]*ON CONFLICT \(token\) DO UPDATE/i);
    expect(migrationSql).toMatch(/UPDATE public\.drivers[\s\S]*SET device_token = p_token/i);
  });

  test('atomic unregister RPC rejects stale generation and protects newer state', () => {
    expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.driver_unregister_device_token_atomic\([\s\S]*p_generation bigint/i);
    expect(migrationSql).toMatch(/IF p_generation < v_current\.registration_generation THEN[\s\S]*RETURN 'stale'/i);
    expect(migrationSql).toMatch(/v_current\.registration_generation = p_generation[\s\S]*UPDATE public\.driver_device_tokens[\s\S]*revoked_at = v_now/i);
  });

  test('migration grants RPC execute only to service_role', () => {
    expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.driver_register_device_token_atomic\([^)]*\) TO service_role/i);
    expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.driver_unregister_device_token_atomic\([^)]*\) TO service_role/i);
    expect(migrationSql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.driver_register_device_token_atomic\([^)]*\) TO authenticated/i);
    expect(migrationSql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.driver_unregister_device_token_atomic\([^)]*\) TO authenticated/i);
  });
});
