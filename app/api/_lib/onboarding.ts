import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCanonicalSiteOrigin } from '../../../lib/siteUrl';

export const ONBOARDING_ACCOUNT_TYPES = [
  'customer_shipper',
  'broker_shipper',
  'fleet_courier',
  'individual_driver',
  'owner_driver',
] as const;
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

export const FLEET_DOCUMENT_TYPES = [
  'operator_licence',
  'public_liability',
  'goods_in_transit',
  'vehicle_insurance',
  'company_registration',
  'vat_registration',
] as const;

export const INDIVIDUAL_DRIVER_DOCUMENT_TYPES = [
  'driving_licence',
  'proof_of_address',
  'right_to_work',
  'visa_document',
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

const ONBOARDING_ACCOUNT_TYPE_ALIASES: Readonly<Record<string, OnboardingAccountType>> = {
  individual_driver: 'individual_driver',
  'individual-driver': 'individual_driver',
  driver_only: 'individual_driver',
  'driver-only': 'individual_driver',
  solo_driver: 'individual_driver',

  // company_driver and fleet_driver describe drivers employed by a carrier.
  // They belong to the fleet_courier onboarding flow (creates a company workspace).
  company_driver: 'fleet_courier',
  fleet_driver: 'fleet_courier',

  owner_driver: 'owner_driver',
  'owner-driver': 'owner_driver',
  owner_operator: 'owner_driver',
  'owner-operator': 'owner_driver',
  sole_trader: 'owner_driver',

  fleet_courier: 'fleet_courier',
  'fleet/courier': 'fleet_courier',
  fleet_operator: 'fleet_courier',
  company_admin: 'fleet_courier',

  customer_shipper: 'customer_shipper',
  customer: 'customer_shipper',
  shipper: 'customer_shipper',
  client: 'customer_shipper',

  transport_broker: 'broker_shipper',
  freight_broker: 'broker_shipper',
  broker: 'broker_shipper',
  broker_shipper: 'broker_shipper',
};

export const normalizeOnboardingAccountType = (
  raw: string | null | undefined
): OnboardingAccountType | null => {
  const value = (raw ?? '').toLowerCase().trim();
  if (!value) return null;
  return ONBOARDING_ACCOUNT_TYPE_ALIASES[value] ?? null;
};

export const isLegacyIndividualDriverOnboardingApplication = (
  accountType: string | null | undefined,
  createdAt: string | null | undefined
) => {
  if (normalizeOnboardingAccountType(accountType) !== 'individual_driver') return false;
  if (!createdAt) return true;
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) return true;
  return createdAtMs < Date.parse(INDIVIDUAL_DRIVER_ONBOARDING_LEGACY_CUTOFF_ISO);
};

export const resolveOnboardingAccountTypeFromMetadata = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
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
    // Prevent client-supplied metadata from enabling the deprecated individual-driver onboarding flow.
    if (normalized === 'individual_driver') continue;
    if (normalized) return normalized;
  }

  return null;
};

export const generateOnboardingToken = () => crypto.randomBytes(32).toString('base64url');

export const hashOnboardingToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const resolveOnboardingTokenTtlHours = async (
  supabaseAdmin: SupabaseClient | null
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
  accountType: OnboardingAccountType
) => {
  const origin = getCanonicalSiteOrigin().replace(
    'https://www.xdrivelogistics.co.uk',
    'https://xdrivelogistics.co.uk'
  );
  const segment = ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE[accountType];
  return `${origin}/onboarding/${segment}/${token}`;
};