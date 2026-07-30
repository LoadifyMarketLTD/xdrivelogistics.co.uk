import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalSiteOrigin } from '../../../lib/siteUrl';
import {
  BROKER_DOCUMENT_TYPES,
  COMPANY_DRIVER_DOCUMENT_TYPES,
  FLEET_DOCUMENT_TYPES,
  OWNER_DRIVER_DOCUMENT_TYPES,
  normalizeCanonicalOnboardingAccountType,
  toPersistedOnboardingAccountType,
  type PersistedOnboardingAccountType,
} from '../../../lib/onboardingContract';

export {
  BROKER_DOCUMENT_TYPES,
  COMPANY_DRIVER_DOCUMENT_TYPES,
  FLEET_DOCUMENT_TYPES,
  OWNER_DRIVER_DOCUMENT_TYPES,
};

// The database still stores company-driver applications under the historical
// value `individual_driver`. Product language and permissions use Company Driver.
export const INDIVIDUAL_DRIVER_DOCUMENT_TYPES = COMPANY_DRIVER_DOCUMENT_TYPES;

export const ONBOARDING_ACCOUNT_TYPES = [
  'customer_shipper',
  'broker_shipper',
  'fleet_courier',
  'individual_driver',
  'owner_driver',
] as const satisfies readonly PersistedOnboardingAccountType[];
export type OnboardingAccountType = (typeof ONBOARDING_ACCOUNT_TYPES)[number];

export const ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE: Record<
  OnboardingAccountType,
  'customer' | 'broker' | 'fleet' | 'individual-driver' | 'owner-driver'
> = {
  customer_shipper: 'customer',
  broker_shipper: 'broker',
  fleet_courier: 'fleet',
  individual_driver: 'individual-driver',
  owner_driver: 'owner-driver',
};

export const ONBOARDING_ACCOUNT_TYPE_BY_ROUTE_SEGMENT: Record<
  'customer' | 'broker' | 'fleet' | 'individual-driver' | 'owner-driver',
  OnboardingAccountType
> = {
  customer: 'customer_shipper',
  broker: 'broker_shipper',
  fleet: 'fleet_courier',
  'individual-driver': 'individual_driver',
  'owner-driver': 'owner_driver',
};

export const ONBOARDING_UNLOCKED_STATUS = 'approved';

export const ONBOARDING_STATUSES = [
  'invited',
  'draft',
  'in_progress',
  'under_review',
  'approved',
  'rejected',
  'request_changes',
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export const INDIVIDUAL_DRIVER_ONBOARDING_LEGACY_CUTOFF_ISO = '2026-07-26T00:00:00.000Z';

const LEGACY_ONBOARDING_STATUS_MAPPING: Record<string, OnboardingStatus> = {
  submitted: 'under_review',
  compliance_review: 'under_review',
  admin_approval: 'under_review',
};

export const normalizeOnboardingStatus = (raw: string | null | undefined): OnboardingStatus => {
  const value = (raw ?? '').toLowerCase().trim();
  if ((ONBOARDING_STATUSES as readonly string[]).includes(value)) {
    return value as OnboardingStatus;
  }
  return LEGACY_ONBOARDING_STATUS_MAPPING[value] ?? 'draft';
};

export const normalizeOnboardingAccountType = (
  raw: string | null | undefined,
): OnboardingAccountType | null => {
  const persisted = toPersistedOnboardingAccountType(raw);
  if (!persisted) return null;
  return (ONBOARDING_ACCOUNT_TYPES as readonly string[]).includes(persisted)
    ? (persisted as OnboardingAccountType)
    : null;
};

export const isLegacyIndividualDriverOnboardingApplication = (
  accountType: string | null | undefined,
  createdAt: string | null | undefined,
) => {
  if (normalizeOnboardingAccountType(accountType) !== 'individual_driver') return false;
  if (!createdAt) return true;
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) return true;
  return createdAtMs < Date.parse(INDIVIDUAL_DRIVER_ONBOARDING_LEGACY_CUTOFF_ISO);
};

export const resolveOnboardingAccountTypeFromMetadata = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined,
): OnboardingAccountType | null => {
  // Requested/signup role is more specific than the legacy account_type field.
  const candidates = [
    userMetadata?.requested_role,
    userMetadata?.signup_type,
    userMetadata?.account_type,
    appMetadata?.requested_role,
    appMetadata?.signup_type,
    appMetadata?.account_type,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const normalized = normalizeOnboardingAccountType(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export const resolveCanonicalOnboardingAccountTypeFromMetadata = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined,
) => {
  const candidates = [
    userMetadata?.requested_role,
    userMetadata?.signup_type,
    userMetadata?.account_type,
    appMetadata?.requested_role,
    appMetadata?.signup_type,
    appMetadata?.account_type,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const normalized = normalizeCanonicalOnboardingAccountType(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export const generateOnboardingToken = () => crypto.randomBytes(32).toString('base64url');

export const hashOnboardingToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const resolveOnboardingTokenTtlHours = async (
  supabaseAdmin: SupabaseClient | null,
): Promise<number> => {
  const envValue = Number.parseInt(process.env.ONBOARDING_TOKEN_TTL_HOURS ?? '', 10);
  const fallback = Number.isFinite(envValue) && envValue > 0 ? envValue : 72;

  if (!supabaseAdmin) return fallback;

  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'onboarding_token_ttl_hours')
    .maybeSingle();

  const configured = Number.parseInt(String(data?.value ?? ''), 10);
  if (!Number.isFinite(configured) || configured < 1) return fallback;
  return configured;
};

export const buildOnboardingUrl = (
  token: string,
  accountType: OnboardingAccountType,
) => {
  const origin = getCanonicalSiteOrigin().replace(
    'https://www.xdrivelogistics.co.uk',
    'https://xdrivelogistics.co.uk',
  );
  const segment = ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE[accountType];
  return `${origin}/onboarding/${segment}/${token}`;
};
