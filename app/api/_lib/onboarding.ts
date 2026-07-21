import crypto from 'crypto';
import { getCanonicalSiteOrigin } from '../../../lib/siteUrl';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPES,
  fromStoredOnboardingAccountType,
  normalizeAccountType,
  toStoredOnboardingAccountType,
  type AccountType,
  type OnboardingRouteSegment,
  type StoredOnboardingAccountType,
} from '../../../lib/accountTypes';

export const ONBOARDING_ACCOUNT_TYPES = ACCOUNT_TYPES.map(
  toStoredOnboardingAccountType
) as readonly StoredOnboardingAccountType[];
export type OnboardingAccountType = StoredOnboardingAccountType;

export const ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE: Record<
  OnboardingAccountType,
  OnboardingRouteSegment
> = {
  customer_shipper: ACCOUNT_TYPE_CONFIG.customer.onboardingRouteSegment,
  broker_shipper: ACCOUNT_TYPE_CONFIG.broker.onboardingRouteSegment,
  fleet_courier: ACCOUNT_TYPE_CONFIG.fleet_operator.onboardingRouteSegment,
  owner_driver: ACCOUNT_TYPE_CONFIG.owner_driver.onboardingRouteSegment,
};

export const ONBOARDING_ACCOUNT_TYPE_BY_ROUTE_SEGMENT: Record<
  OnboardingRouteSegment,
  OnboardingAccountType
> = {
  customer: ACCOUNT_TYPE_CONFIG.customer.storedAccountType,
  broker: ACCOUNT_TYPE_CONFIG.broker.storedAccountType,
  fleet: ACCOUNT_TYPE_CONFIG.fleet_operator.storedAccountType,
  'owner-driver': ACCOUNT_TYPE_CONFIG.owner_driver.storedAccountType,
};

export const FLEET_DOCUMENT_TYPES = [
  'operator_licence',
  'public_liability',
  'goods_in_transit',
  'vehicle_insurance',
  'company_registration',
  'vat_registration',
] as const;

export const OWNER_DRIVER_DOCUMENT_TYPES = [
  'driving_licence',
  'cpc',
  'proof_of_address',
  'insurance',
  'right_to_work',
  'visa_document',
] as const;

export const BROKER_DOCUMENT_TYPES = [
  'company_registration',
  'public_liability',
  'vat_registration',
] as const;

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

/**
 * Convert any supported public or legacy alias to the database storage value.
 * New browser/API payloads use AccountType from lib/accountTypes.ts; legacy
 * aliases are accepted only here at the persistence compatibility boundary.
 */
export const normalizeOnboardingAccountType = (
  raw: string | null | undefined
): OnboardingAccountType | null => {
  const canonical = normalizeAccountType(raw);
  return canonical ? toStoredOnboardingAccountType(canonical) : null;
};

export const toPublicAccountType = (
  raw: string | null | undefined
): AccountType | null => fromStoredOnboardingAccountType(raw);

export const resolveOnboardingAccountTypeFromMetadata = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
): AccountType | null => {
  const candidates = [
    userMetadata?.account_type,
    userMetadata?.requested_role,
    userMetadata?.signup_type,
    appMetadata?.account_type,
    appMetadata?.requested_role,
    appMetadata?.signup_type,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAccountType(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export const generateOnboardingToken = () => crypto.randomBytes(32).toString('base64url');

export const hashOnboardingToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const resolveOnboardingTokenTtlHours = async (supabaseAdmin: SupabaseClient | null): Promise<number> => {
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

export const buildOnboardingUrl = (token: string, accountType: OnboardingAccountType) => {
  const origin = getCanonicalSiteOrigin().replace('https://www.xdrivelogistics.co.uk', 'https://xdrivelogistics.co.uk');
  const segment = ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE[accountType];
  return `${origin}/onboarding/${segment}/${token}`;
};
