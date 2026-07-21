import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ACCOUNT_TYPE_CONFIG,
  fromStoredOnboardingAccountType,
  resolveAccountTypeFromMetadata,
  toStoredOnboardingAccountType,
  type AccountType,
  type StoredOnboardingAccountType,
} from '../../../lib/accountTypes';
import { getCanonicalSiteOrigin } from '../../../lib/siteUrl';

export const ONBOARDING_ACCOUNT_TYPES = [
  'customer_shipper',
  'broker_shipper',
  'fleet_courier',
  'owner_driver',
] as const satisfies readonly StoredOnboardingAccountType[];
export type OnboardingAccountType = StoredOnboardingAccountType;

export const ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE: Record<
  OnboardingAccountType,
  'customer' | 'broker' | 'fleet' | 'owner-driver'
> = {
  customer_shipper: 'customer',
  broker_shipper: 'broker',
  fleet_courier: 'fleet',
  owner_driver: 'owner-driver',
};

export const ONBOARDING_ACCOUNT_TYPE_BY_ROUTE_SEGMENT: Record<
  'customer' | 'broker' | 'fleet' | 'owner-driver',
  OnboardingAccountType
> = {
  customer: 'customer_shipper',
  broker: 'broker_shipper',
  fleet: 'fleet_courier',
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
  pending_approval: 'under_review',
};

export const normalizeOnboardingStatus = (raw: string | null | undefined): OnboardingStatus => {
  const value = (raw ?? '').toLowerCase().trim();
  if ((ONBOARDING_STATUSES as readonly string[]).includes(value)) {
    return value as OnboardingStatus;
  }
  return LEGACY_ONBOARDING_STATUS_MAPPING[value] ?? 'draft';
};

export const normalizeOnboardingAccountType = (
  raw: unknown
): OnboardingAccountType | null => {
  const publicType = fromStoredOnboardingAccountType(raw);
  return publicType ? toStoredOnboardingAccountType(publicType) : null;
};

export const resolveOnboardingAccountTypeFromMetadata = (
  userMetadata: Record<string, unknown> | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined
): OnboardingAccountType | null => {
  const publicType = resolveAccountTypeFromMetadata(userMetadata, appMetadata);
  return publicType ? toStoredOnboardingAccountType(publicType) : null;
};

export const publicAccountTypeFromStored = (
  stored: OnboardingAccountType
): AccountType => {
  const accountType = fromStoredOnboardingAccountType(stored);
  if (!accountType) throw new Error(`Unsupported onboarding account type: ${stored}`);
  return accountType;
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
  const publicType = publicAccountTypeFromStored(accountType);
  const segment = ACCOUNT_TYPE_CONFIG[publicType].onboardingRouteSegment;
  return `${origin}/onboarding/${segment}/${token}`;
};
