import crypto from 'crypto';
import { getCanonicalSiteOrigin } from '../../../lib/siteUrl';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ONBOARDING_ACCOUNT_TYPES = ['broker_shipper', 'fleet_courier', 'owner_driver'] as const;
export type OnboardingAccountType = (typeof ONBOARDING_ACCOUNT_TYPES)[number];

export const ONBOARDING_UNLOCKED_STATUS = 'approved';

export const ONBOARDING_STATUSES = [
  'draft',
  'in_progress',
  'submitted',
  'under_review',
  'compliance_review',
  'admin_approval',
  'approved',
  'rejected',
  'request_changes',
] as const;

export const normalizeOnboardingAccountType = (raw: string | null | undefined): OnboardingAccountType => {
  const value = (raw ?? '').toLowerCase().trim();
  if (value === 'owner_driver' || value === 'owner-driver' || value === 'sole_trader') return 'owner_driver';
  if (value === 'fleet_courier' || value === 'fleet/courier' || value === 'company_admin') return 'fleet_courier';
  return 'broker_shipper';
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

  return 'broker_shipper';
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

export const buildOnboardingUrl = (token: string) => {
  const origin = getCanonicalSiteOrigin().replace('https://www.xdrivelogistics.co.uk', 'https://xdrivelogistics.co.uk');
  return `${origin}/onboarding/${token}`;
};
