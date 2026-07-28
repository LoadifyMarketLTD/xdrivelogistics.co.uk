import { describe, expect, test } from 'vitest';
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
