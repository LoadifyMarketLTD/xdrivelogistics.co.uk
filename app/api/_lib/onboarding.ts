import crypto from 'crypto';
import { getCanonicalSiteOrigin } from '../../../lib/siteUrl';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ONBOARDING_ACCOUNT_TYPES = ['customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver'] as const;
export type OnboardingAccountType = (typeof ONBOARDING_ACCOUNT_TYPES)[number];
export const ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE: Record<OnboardingAccountType, 'customer' | 'broker' | 'fleet' | 'owner-driver'> = {
  customer_shipper: 'customer',
  broker_shipper: 'broker',
  fleet_courier: 'fleet',
  owner_driver: 'owner-driver',
};

export const ONBOARDING_ACCOUNT_TYPE_BY_ROUTE_SEGMENT: Record<'customer' | 'broker' | 'fleet' | 'owner-driver', OnboardingAccountType> = {
  customer: 'customer_shipper',
  broker: 'broker_shipper',
  fleet: 'fleet_courier',
  'owner-driver': 'owner_driver',
};

export const FLEET_DOCUMENT_TYPES = [
  'operator_licence',
  'public_liability',
  'goods_in_transit',
  'motor_fleet_insurance',
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

export const ONBOARDING_UNLOCKED_STATUS = 'approved';

export const ONBOARDING_STATUSES = [
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

export const normalizeOnboardingAccountType = (raw: string | null | undefined): OnboardingAccountType => {
  const value = (raw ?? '').toLowerCase().trim();
  if (
    value === 'owner_driver' ||
    value === 'owner-driver' ||
    value === 'owner_operator' ||
    value === 'owner-operator' ||
    value === 'sole_trader'
  ) return 'owner_driver';
  if (
    value === 'fleet_courier' ||
    value === 'fleet/courier' ||
    value === 'fleet_operator' ||
    value === 'company_admin'
  ) return 'fleet_courier';
  if (
    value === 'customer_shipper' ||
    value === 'customer' ||
    value === 'shipper'
  ) return 'customer_shipper';
  if (
    value === 'transport_broker' ||
    value === 'broker' ||
    value === 'broker_shipper'
  ) return 'broker_shipper';
  return 'customer_shipper';
};

export const resolveOnboardingAccountTypeFromMetadata = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
): OnboardingAccountType => {
  const candidates = [
    typeof userMetadata?.account_type === 'string' ? userMetadata.account_type : null,
    typeof userMetadata?.requested_role === 'string' ? userMetadata.requested_role : null,
    typeof appMetadata?.account_type === 'string' ? appMetadata.account_type : null,
    typeof appMetadata?.requested_role === 'string' ? appMetadata.requested_role : null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeOnboardingAccountType(candidate);
    if (normalized) return normalized;
  }

  return 'customer_shipper';
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
