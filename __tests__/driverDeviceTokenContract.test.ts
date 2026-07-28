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

  test('accepts strict register payload with defaults', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(160),
      }),
    ).toEqual({
      ok: true,
      value: {
        token: 'x'.repeat(160),
        platform: 'android',
        appPackage: null,
      },
    });
  });

  test('accepts strict register payload with app package', () => {
    expect(
      parseDeviceTokenRegisterBody({
        token: 'x'.repeat(140),
        platform: 'android',
        app_package: 'co.uk.xdrivelogistics.driver',
      }),
    ).toEqual({
      ok: true,
      value: {
        token: 'x'.repeat(140),
        platform: 'android',
        appPackage: 'co.uk.xdrivelogistics.driver',
      },
    });
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
});
