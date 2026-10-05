import type { SupabaseClient } from '@supabase/supabase-js';
import { XDRIVE_LOGISTICS_COMPANY_ID } from '../../../lib/activeWorkspace';
import { isStripeServerConfigured, stripeRequest } from './stripeServer';
import { getFeatureFlag } from './platformFlags';

type AdminClient = SupabaseClient;

export type StripeCommercialReadiness = {
  ready: boolean;
  required: boolean;
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingStatus: string | null;
  infrastructureAvailable: boolean;
};

const missingSchema = (error: { code?: string | null } | null | undefined) =>
  Boolean(error && ['PGRST205', '42P01', '42703'].includes(String(error.code ?? '')));

export async function getStripeCommercialReadiness(
  supabaseAdmin: AdminClient,
  companyId: string | null | undefined,
): Promise<StripeCommercialReadiness> {
  const required = await getFeatureFlag(supabaseAdmin, 'stripe_billing_future_phase');
  if (!required) {
    return {
      ready: true,
      required: false,
      accountId: null,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingStatus: 'not_required',
      infrastructureAvailable: true,
    };
  }

  if (!companyId) {
    return {
      ready: false,
      required: true,
      accountId: null,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingStatus: null,
      infrastructureAvailable: true,
    };
  }

  if (companyId === XDRIVE_LOGISTICS_COMPANY_ID) {
    if (!isStripeServerConfigured) {
      return {
        ready: false,
        required: true,
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingStatus: null,
        infrastructureAvailable: false,
      };
    }
    const account = await stripeRequest<{ id: string; details_submitted?: boolean; charges_enabled?: boolean; payouts_enabled?: boolean }>('/account', { method: 'GET' });
    const detailsSubmitted = account.details_submitted === true;
    const chargesEnabled = account.charges_enabled === true;
    const payoutsEnabled = account.payouts_enabled === true;
    return {
      ready: Boolean(account.id && detailsSubmitted && chargesEnabled && payoutsEnabled),
      required: true,
      accountId: account.id || null,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
      onboardingStatus: detailsSubmitted && chargesEnabled && payoutsEnabled ? 'enabled' : 'restricted',
      infrastructureAvailable: true,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('stripe_connected_accounts')
    .select('stripe_account_id, details_submitted, charges_enabled, payouts_enabled, onboarding_status')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    if (missingSchema(error)) {
      return {
        ready: false,
        required: true,
        accountId: null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingStatus: null,
        infrastructureAvailable: false,
      };
    }
    throw new Error(error.message);
  }

  const detailsSubmitted = data?.details_submitted === true;
  const chargesEnabled = data?.charges_enabled === true;
  const payoutsEnabled = data?.payouts_enabled === true;
  const accountId = typeof data?.stripe_account_id === 'string' ? data.stripe_account_id : null;
  const onboardingStatus = typeof data?.onboarding_status === 'string' ? data.onboarding_status : null;

  return {
    ready: Boolean(accountId && detailsSubmitted && chargesEnabled && payoutsEnabled),
    required: true,
    accountId,
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    onboardingStatus,
    infrastructureAvailable: true,
  };
}

export const STRIPE_COMMERCIAL_READINESS_CODE = 'STRIPE_COMMERCIAL_READINESS_REQUIRED';

export function stripeCommercialReadinessPayload(message: string) {
  return {
    error: message,
    code: STRIPE_COMMERCIAL_READINESS_CODE,
    setupUrl: '/settings/payments',
  };
}
