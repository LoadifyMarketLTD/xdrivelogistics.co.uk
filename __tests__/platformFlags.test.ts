/**
 * Unit tests for platformFlags.ts
 *
 * Tests that getFeatureFlag and getGlobalSetting:
 * - Return correct values from DB
 * - Fall back to in-code defaults when DB row is absent
 * - Apply fail-open/fail-closed policy correctly
 * - Handle multi-key batch resolution
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  flagRows: [] as Array<{ key: string; is_enabled: boolean }>,
  flagError: null as { message: string } | null,
  settingRows: [] as Array<{ key: string; value: string }>,
  settingError: null as { message: string } | null,
}));

const makeMockClient = () => ({
  from: (table: string) => {
    if (table === 'platform_feature_flags') {
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: mocks.flagRows.find((r) => r.key === key) ?? null,
                error: mocks.flagError,
              }),
          }),
          in: (_col: string, _keys: string[]) =>
            Promise.resolve({
              data: mocks.flagRows.filter((r) => _keys.includes(r.key)),
              error: mocks.flagError,
            }),
        }),
      };
    }
    if (table === 'platform_settings') {
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: mocks.settingRows.find((r) => r.key === key) ?? null,
                error: mocks.settingError,
              }),
          }),
          in: (_col: string, keys: string[]) =>
            Promise.resolve({
              data: mocks.settingRows.filter((r) => keys.includes(r.key)),
              error: mocks.settingError,
            }),
        }),
      };
    }
    return {};
  },
});

import {
  getFeatureFlag,
  getFeatureFlags,
  getGlobalSetting,
  getGlobalSettingBoolean,
  getGlobalSettingNumber,
  getGlobalSettings,
} from '../app/api/_lib/platformFlags';

import type { SupabaseClient } from '@supabase/supabase-js';

beforeEach(() => {
  mocks.flagRows = [];
  mocks.flagError = null;
  mocks.settingRows = [];
  mocks.settingError = null;
});

// ---------------------------------------------------------------------------
// getFeatureFlag
// ---------------------------------------------------------------------------

describe('getFeatureFlag', () => {
  it('returns true when DB row has is_enabled = true', async () => {
    mocks.flagRows = [{ key: 'exchange_marketplace', is_enabled: true }];
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'exchange_marketplace');
    expect(result).toBe(true);
  });

  it('returns false when DB row has is_enabled = false', async () => {
    mocks.flagRows = [{ key: 'exchange_marketplace', is_enabled: false }];
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'exchange_marketplace');
    expect(result).toBe(false);
  });

  it('falls back to in-code default (true) when DB row is absent — exchange_marketplace', async () => {
    mocks.flagRows = [];
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'exchange_marketplace');
    expect(result).toBe(true); // default is true
  });

  it('falls back to in-code default (false) when DB row is absent — stripe_billing_future_phase', async () => {
    mocks.flagRows = [];
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'stripe_billing_future_phase');
    expect(result).toBe(false); // default is false
  });

  it('fail-OPEN for audit_logging when DB errors', async () => {
    mocks.flagError = { message: 'connection timeout' };
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'audit_logging');
    expect(result).toBe(true); // fail-open
  });

  it('fail-CLOSED for exchange_marketplace when DB errors', async () => {
    mocks.flagError = { message: 'connection timeout' };
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'exchange_marketplace');
    expect(result).toBe(true); // default is true, DB error = use default (true)
  });

  it('fail-CLOSED for stripe_billing_future_phase when DB errors', async () => {
    mocks.flagError = { message: 'connection timeout' };
    const result = await getFeatureFlag(makeMockClient() as unknown as SupabaseClient, 'stripe_billing_future_phase');
    expect(result).toBe(false); // default is false = fail-closed for this flag
  });
});

// ---------------------------------------------------------------------------
// getFeatureFlags (batch)
// ---------------------------------------------------------------------------

describe('getFeatureFlags', () => {
  it('resolves multiple flags in a single call', async () => {
    mocks.flagRows = [
      { key: 'exchange_marketplace', is_enabled: false },
      { key: 'invoice_generation', is_enabled: true },
    ];
    const result = await getFeatureFlags(
      makeMockClient() as unknown as SupabaseClient,
      ['exchange_marketplace', 'invoice_generation', 'notifications'],
    );
    expect(result.get('exchange_marketplace')).toBe(false);
    expect(result.get('invoice_generation')).toBe(true);
    expect(result.get('notifications')).toBe(true); // default
  });

  it('returns empty map for empty keys array', async () => {
    const result = await getFeatureFlags(makeMockClient() as unknown as SupabaseClient, []);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getGlobalSetting
// ---------------------------------------------------------------------------

describe('getGlobalSetting', () => {
  it('returns DB value when present', async () => {
    mocks.settingRows = [{ key: 'default_currency', value: 'EUR' }];
    const result = await getGlobalSetting(makeMockClient() as unknown as SupabaseClient, 'default_currency');
    expect(result).toBe('EUR');
  });

  it('falls back to in-code default when DB row absent', async () => {
    mocks.settingRows = [];
    const result = await getGlobalSetting(makeMockClient() as unknown as SupabaseClient, 'default_currency');
    expect(result).toBe('GBP'); // in-code default
  });

  it('falls back to in-code default on DB error', async () => {
    mocks.settingError = { message: 'db down' };
    const result = await getGlobalSetting(makeMockClient() as unknown as SupabaseClient, 'vat_rate_default_pct');
    expect(result).toBe('20'); // in-code default
  });
});

describe('getGlobalSettingNumber', () => {
  it('parses DB value as number', async () => {
    mocks.settingRows = [{ key: 'max_bids_per_job', value: '50' }];
    const result = await getGlobalSettingNumber(makeMockClient() as unknown as SupabaseClient, 'max_bids_per_job');
    expect(result).toBe(50);
  });

  it('returns default number when DB row absent', async () => {
    mocks.settingRows = [];
    const result = await getGlobalSettingNumber(makeMockClient() as unknown as SupabaseClient, 'exchange_auto_expire_hours');
    expect(result).toBe(72); // in-code default
  });

  it('returns default when DB value is not a valid number', async () => {
    mocks.settingRows = [{ key: 'max_bids_per_job', value: 'not-a-number' }];
    const result = await getGlobalSettingNumber(makeMockClient() as unknown as SupabaseClient, 'max_bids_per_job');
    expect(result).toBe(25); // in-code default
  });
});

describe('getGlobalSettingBoolean', () => {
  it('returns true for "true" string', async () => {
    mocks.settingRows = [{ key: 'compliance_block_posting', value: 'true' }];
    const result = await getGlobalSettingBoolean(makeMockClient() as unknown as SupabaseClient, 'compliance_block_posting');
    expect(result).toBe(true);
  });

  it('returns false for "false" string', async () => {
    mocks.settingRows = [{ key: 'compliance_block_posting', value: 'false' }];
    const result = await getGlobalSettingBoolean(makeMockClient() as unknown as SupabaseClient, 'compliance_block_posting');
    expect(result).toBe(false);
  });

  it('returns in-code default (true) when row absent', async () => {
    mocks.settingRows = [];
    const result = await getGlobalSettingBoolean(makeMockClient() as unknown as SupabaseClient, 'compliance_block_posting');
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getGlobalSettings (batch)
// ---------------------------------------------------------------------------

describe('getGlobalSettings', () => {
  it('resolves multiple settings in a single call', async () => {
    mocks.settingRows = [
      { key: 'platform_name', value: 'XDrive Test' },
      { key: 'default_currency', value: 'USD' },
    ];
    const result = await getGlobalSettings(
      makeMockClient() as unknown as SupabaseClient,
      ['platform_name', 'default_currency', 'default_timezone'],
    );
    expect(result.get('platform_name')).toBe('XDrive Test');
    expect(result.get('default_currency')).toBe('USD');
    expect(result.get('default_timezone')).toBe('Europe/London'); // default
  });

  it('returns empty map for empty keys array', async () => {
    const result = await getGlobalSettings(makeMockClient() as unknown as SupabaseClient, []);
    expect(result.size).toBe(0);
  });
});
