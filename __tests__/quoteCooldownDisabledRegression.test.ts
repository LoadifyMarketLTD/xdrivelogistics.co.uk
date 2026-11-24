import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const api = readFileSync('app/api/driver/_lib/submitQuote.ts', 'utf8');
const flags = readFileSync('app/api/_lib/platformFlags.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261124042200_disable_quote_submission_cooldown.sql', 'utf8');

describe('quotes have no mandatory five-minute pause', () => {
  it('removes the driver quote cooldown from the API', () => {
    expect(api).not.toContain('minBidIntervalMinutes');
    expect(api).not.toContain('before submitting another quote');
    expect(api).toContain("getGlobalSettingNumber(supabaseAdmin, 'max_bids_per_job')");
  });
  it('keeps the setting fallback disabled', () => {
    expect(flags).toMatch(/min_bid_interval_minutes:\s*\{ value: '0'/);
  });
  it('disables the existing database guards using an idempotent setting migration', () => {
    expect(migration).toContain("'min_bid_interval_minutes'");
    expect(migration).toContain("'0', 'number'");
    expect(migration).toContain('ON CONFLICT (key) DO UPDATE');
  });
  it('preserves duplicate-per-job and bid caps', () => {
    expect(api).toContain('maxBidsPerJob > 0');
    expect(api).toContain('jobId');
    expect(api).toContain('already has an active quote');
  });
});
