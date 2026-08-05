/**
 * Server-side feature flag and global setting helpers.
 *
 * These are the canonical consumers of the `platform_feature_flags` and
 * `platform_settings` tables.  Every API route that needs to gate behaviour
 * behind a flag MUST use `getFeatureFlag()` rather than hard-coding defaults.
 *
 * Fail-open/fail-closed policy
 * ------------------------------
 * Feature flags:  fail-CLOSED — if the DB is unavailable the flag is treated
 *   as disabled (safe default: features are off, not accidentally on).
 *   Exception: `audit_logging` and `company_suspension` fail-OPEN because
 *   disabling them silently would be worse than leaving them on.
 *
 * Global settings: fall back to the in-code default when the DB row is absent.
 *   This is intentional — the settings table is only written when an operator
 *   explicitly overrides the value.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Feature flag keys — must stay in sync with FLAG_DEFINITIONS in settings/route.ts
// and the DB seed in supabase/migrations/20260725170000_platform_feature_flags.sql
// ---------------------------------------------------------------------------

export type FeatureFlagKey =
  | 'exchange_marketplace'
  | 'bid_acceptance_workflow'
  | 'pod_capture'
  | 'invoice_generation'
  | 'dispute_filing'
  | 'stripe_billing_future_phase'
  | 'notifications'
  | 'document_review'
  | 'broker_carrier_network'
  | 'driver_mobile_app'
  | 'company_suspension'
  | 'audit_logging';

/**
 * Flags that fail-OPEN (enabled=true) when the DB cannot be reached.
 * These are safety/governance features where disabling them silently is riskier
 * than keeping them on.
 */
const FAIL_OPEN_FLAGS = new Set<FeatureFlagKey>([
  'audit_logging',
  'company_suspension',
]);

/**
 * In-code defaults.  These mirror FLAG_DEFINITIONS.enabled in settings/route.ts.
 * They are used when the DB row has never been written (e.g. fresh deployment).
 */
const FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  exchange_marketplace: true,
  bid_acceptance_workflow: true,
  pod_capture: true,
  invoice_generation: true,
  dispute_filing: true,
  stripe_billing_future_phase: false,
  notifications: true,
  document_review: true,
  broker_carrier_network: true,
  driver_mobile_app: true,
  company_suspension: true,
  audit_logging: true,
};

/**
 * Resolves a single feature flag for the given Supabase admin client.
 *
 * @param supabase  - A Supabase admin client (supabaseAdmin from _lib/supabaseAdmin)
 * @param key       - The canonical flag key
 * @returns         - `true` if the feature is enabled, `false` otherwise
 *
 * @example
 *   const enabled = await getFeatureFlag(supabaseAdmin, 'invoice_generation');
 *   if (!enabled) return respond(403, { error: 'Invoice generation is disabled.' });
 */
export async function getFeatureFlag(
  supabase: SupabaseClient,
  key: FeatureFlagKey,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('platform_feature_flags')
    .select('is_enabled')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) {
    // DB miss — use fail-open/closed policy
    return FAIL_OPEN_FLAGS.has(key) ? true : (FLAG_DEFAULTS[key] ?? false);
  }

  return Boolean(data.is_enabled);
}

/**
 * Resolves multiple feature flags in a single DB round-trip.
 *
 * @param supabase - A Supabase admin client
 * @param keys     - Array of flag keys to resolve
 * @returns        - A Map<key, boolean> with each flag's effective value
 *
 * @example
 *   const flags = await getFeatureFlags(supabaseAdmin, ['invoice_generation', 'notifications']);
 *   if (!flags.get('invoice_generation')) return respond(403, { error: '...' });
 */
export async function getFeatureFlags(
  supabase: SupabaseClient,
  keys: FeatureFlagKey[],
): Promise<Map<FeatureFlagKey, boolean>> {
  const result = new Map<FeatureFlagKey, boolean>();

  if (keys.length === 0) return result;

  const { data, error } = await supabase
    .from('platform_feature_flags')
    .select('key, is_enabled')
    .in('key', keys);

  const dbValues = new Map<string, boolean>(
    ((data ?? []) as Array<{ key: string; is_enabled: boolean }>).map((row) => [
      row.key,
      Boolean(row.is_enabled),
    ]),
  );

  for (const key of keys) {
    if (error || !dbValues.has(key)) {
      result.set(key, FAIL_OPEN_FLAGS.has(key) ? true : (FLAG_DEFAULTS[key] ?? false));
    } else {
      result.set(key, dbValues.get(key)!);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Global settings helpers
// ---------------------------------------------------------------------------

export type GlobalSettingKey =
  | 'platform_name'
  | 'platform_domain'
  | 'support_email'
  | 'default_currency'
  | 'default_timezone'
  | 'min_bid_interval_minutes'
  | 'max_bids_per_job'
  | 'exchange_auto_expire_hours'
  | 'vat_rate_default_pct'
  | 'doc_expiry_warning_days'
  | 'compliance_block_posting'
  | 'driver_doc_required'
  | 'vehicle_doc_required'
  | 'company_approval_required'
  | 'invite_email_provider'
  | 'default_company_status';

type SettingType = 'text' | 'number' | 'boolean';

const SETTING_DEFAULTS: Record<GlobalSettingKey, { value: string; type: SettingType }> = {
  platform_name:               { value: 'XDrive Logistics',               type: 'text' },
  platform_domain:             { value: 'xdrivelogistics.co.uk',          type: 'text' },
  support_email:               { value: 'contact@xdrivelogistics.co.uk',  type: 'text' },
  default_currency:            { value: 'GBP',                            type: 'text' },
  default_timezone:            { value: 'Europe/London',                  type: 'text' },
  min_bid_interval_minutes:    { value: '5',                              type: 'number' },
  max_bids_per_job:            { value: '25',                             type: 'number' },
  exchange_auto_expire_hours:  { value: '72',                             type: 'number' },
  vat_rate_default_pct:        { value: '20',                             type: 'number' },
  doc_expiry_warning_days:     { value: '30',                             type: 'number' },
  compliance_block_posting:    { value: 'true',                           type: 'boolean' },
  driver_doc_required:         { value: 'driving_licence, cpc_card, insurance', type: 'text' },
  vehicle_doc_required:        { value: 'mot, insurance',                type: 'text' },
  company_approval_required:   { value: 'true',                           type: 'boolean' },
  invite_email_provider:       { value: 'Supabase Auth',                  type: 'text' },
  default_company_status:      { value: 'pending_approval',               type: 'text' },
};

/**
 * Resolves a global setting as a raw string.
 * Falls back to the in-code default when the DB row is absent.
 */
export async function getGlobalSetting(
  supabase: SupabaseClient,
  key: GlobalSettingKey,
): Promise<string> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (data?.value !== undefined && data.value !== null) {
    return String(data.value);
  }

  return SETTING_DEFAULTS[key]?.value ?? '';
}

/**
 * Resolves a global setting as a number.
 * Returns the in-code default when the DB row is absent or not a valid number.
 */
export async function getGlobalSettingNumber(
  supabase: SupabaseClient,
  key: GlobalSettingKey,
): Promise<number> {
  const raw = await getGlobalSetting(supabase, key);
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  const defaultRaw = SETTING_DEFAULTS[key]?.value ?? '0';
  return Number(defaultRaw) || 0;
}

/**
 * Resolves a global setting as a boolean.
 * Returns the in-code default when the DB row is absent.
 */
export async function getGlobalSettingBoolean(
  supabase: SupabaseClient,
  key: GlobalSettingKey,
): Promise<boolean> {
  const raw = await getGlobalSetting(supabase, key);
  return raw.trim().toLowerCase() === 'true';
}

/**
 * Resolves multiple global settings in a single DB round-trip.
 *
 * @param supabase - A Supabase admin client
 * @param keys     - Array of setting keys to resolve
 * @returns        - A Map<key, string> with each setting's effective raw value
 */
export async function getGlobalSettings(
  supabase: SupabaseClient,
  keys: GlobalSettingKey[],
): Promise<Map<GlobalSettingKey, string>> {
  const result = new Map<GlobalSettingKey, string>();

  if (keys.length === 0) return result;

  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', keys);

  const dbValues = new Map<string, string>(
    ((data ?? []) as Array<{ key: string; value: string }>).map((row) => [
      row.key,
      String(row.value),
    ]),
  );

  for (const key of keys) {
    result.set(key, dbValues.get(key) ?? SETTING_DEFAULTS[key]?.value ?? '');
  }

  return result;
}
