import { expect, test } from '@playwright/test';

import {
  buildExpoPushMessage,
  isExpoPushToken,
  parseExpoPushResponse,
} from '../lib/pushNotifications';

test.describe('push notification contract', () => {
  test('accepts Expo push tokens only', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('invalid-token')).toBe(false);
    expect(isExpoPushToken('')).toBe(false);
  });

  test('builds Expo payloads with deep-link data', () => {
    expect(buildExpoPushMessage('ExponentPushToken[abc123]', {
      title: 'New job assigned',
      body: 'Pickup → Delivery',
      data: { path: '/driver/jobs/abc', eventType: 'job_assigned' },
    })).toEqual({
      to: 'ExponentPushToken[abc123]',
      sound: 'default',
      title: 'New job assigned',
      body: 'Pickup → Delivery',
      data: { path: '/driver/jobs/abc', eventType: 'job_assigned' },
    });
  });

  test('invalidates unregistered devices without forcing endless retries', () => {
    const result = parseExpoPushResponse({
      data: [
        {
          status: 'error',
          message: 'Device not registered',
          details: { error: 'DeviceNotRegistered' },
        },
      ],
    }, ['ExponentPushToken[abc123]']);

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[abc123]']);
  });

  test('marks transient Expo failures as retryable', () => {
    const result = parseExpoPushResponse({
      data: [
        {
          status: 'error',
          message: 'Rate limited',
          details: { error: 'MessageRateExceeded' },
        },
      ],
    }, ['ExponentPushToken[retry123]']);

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.invalidTokens).toEqual([]);
  });
});
