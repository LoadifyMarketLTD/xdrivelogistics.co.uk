import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCanonicalSiteOrigin } from '../../../../../lib/siteUrl';
import { getStripePriceId, isStandardMembershipPlan } from '../../../../../lib/commercialBilling';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { isStripeServerConfigured, stripeRequest } from '../../../_lib/stripeServer';

const TERMS_VERSION = '2026-09-01';
const COMPANY_BILLING_ROLES = new Set(['owner', 'admin']);
const CARRIER_PLANS = new Set(['small-carrier', 'growing-carrier', 'fleet']);

const requestSchema = z.object({
  planId: z.string(),
  companyId: z.string().uuid().nullable().optional(),
  acceptedMembershipTerms: z.literal(true),
  termsVersion: z.literal(TERMS_VERSION),
});

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type StripeCustomer = { id: string };
type CheckoutSession = { id: string; url: string | null };

type ExistingSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
};

type StripeRuntimeError = Error & { stripeCode?: string; status?: number };

const stripeFailureResponse = (reason: unknown, operation: string) => {
  const error = (reason instanceof Error
    ? reason
    : new Error('Unknown Stripe runtime failure.')) as StripeRuntimeError;
  console.error(`[billing checkout] ${operation} failed`, {
    message: error.message,
    stripeCode: error.stripeCode ?? null,
    status: error.status ?? null,
  });
  return json(502, {
    error: 'Stripe checkout service failed. Please try again.',
    operation,
    stripeCode: error.stripeCode ?? null,
    stripeStatus: error.status ?? null,
  });
};

const addCalendarMonths = (date: Date, months: number) => {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
};

const parseFutureTrialEnd = (value: string | null | undefined, now: Date) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= now.getTime()) return null;
  return parsed;
};

const expectedCarrierPlan = (vehicleCount: number) => {
  if (vehicleCount <= 5) return 'small-carrier';
  if (vehicleCount <= 15) return 'growing-carrier';
  if (vehicleCount <= 50) return 'fleet';
  return 'enterprise';
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  if (!isStripeServerConfigured) return json(503, { error: 'Stripe is not configured.' });
  if (process.env.STRIPE_TAX_ENABLED !== 'true') {
    return json(503, { error: 'Stripe tax handling is not approved/configured yet.', taxConfigurationRequired: true });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid membership checkout request.' });
  if (!isStandardMembershipPlan(parsed.data.planId)) return json(400, { error: 'Invalid membership plan.' });
  const { planId, companyId = null } = parsed.data;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status, is_driver')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError) return json(500, { error: profileError.message });
  if (!profile || String(profile.status ?? '').toLowerCase() !== 'active') return json(403, { error: 'Active account required.' });
  if (String(profile.role ?? '').toLowerCase() === 'owner') {
    return json(403, { error: 'Platform Owner is outside the commercial membership billing lifecycle.' });
  }

  if (companyId) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('company_id', companyId)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) return json(500, { error: membershipError.message });
    if (!membership) return json(403, { error: 'You cannot purchase membership for this company.' });
    if (!COMPANY_BILLING_ROLES.has(String(membership.role_in_company ?? '').toLowerCase())) {
      return json(403, { error: 'Only a company owner or admin can manage membership billing.' });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('company_type')
      .eq('id', companyId)
      .maybeSingle();
    if (companyError) return json(500, { error: companyError.message });
    if (!company) return json(404, { error: 'Company not found.' });

    const companyType = String(company.company_type ?? '').toLowerCase();
    const profileRole = String(profile.role ?? '').toLowerCase();
    if (companyType === 'customer' && planId !== 'customer-shipper') {
      return json(409, { error: 'Customer / Shipper companies must use the Customer / Shipper membership plan.' });
    }
    if (companyType === 'sole_trader' && planId !== 'owner-driver') {
      return json(409, { error: 'Owner Driver companies must use the Owner Driver membership plan.' });
    }
    if (profileRole === 'broker' && planId !== 'broker') {
      return json(409, { error: 'Broker accounts must use the Broker membership plan.' });
    }
    if (companyType === 'standard' && profileRole !== 'broker') {
      if (!CARRIER_PLANS.has(planId)) {
        return json(409, { error: 'Carrier companies must use a Carrier / Fleet membership plan.' });
      }
      const { count: vehicleCount, error: vehicleError } = await supabaseAdmin
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (vehicleError) return json(500, { error: vehicleError.message });
      const expectedPlan = expectedCarrierPlan(vehicleCount ?? 0);
      if (expectedPlan === 'enterprise') {
        return json(409, { error: 'Fleet operations above 50 vehicles require Enterprise commercial terms.' });
      }
      if (expectedPlan !== planId) {
        return json(409, { error: 'The selected Carrier / Fleet plan does not match the current fleet size.', expectedPlanId: expectedPlan });
      }
    }
  } else {
    const { data: activeMemberships, error: activeMembershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .limit(1);
    if (activeMembershipError) return json(500, { error: activeMembershipError.message });
    if ((activeMemberships ?? []).length > 0) {
      return json(409, { error: 'This account belongs to a company. Membership billing must be managed by that company owner or admin.' });
    }

    const profileRole = String(profile.role ?? '').toLowerCase();
    if (profileRole === 'customer' && planId !== 'customer-shipper') {
      return json(409, { error: 'Customer accounts must use the Customer / Shipper membership plan.' });
    }
    if ((profileRole === 'driver' || profile.is_driver === true) && planId !== 'owner-driver') {
      return json(409, { error: 'Standalone owner-driver accounts must use the Owner Driver membership plan.' });
    }
    if (profileRole !== 'customer' && profileRole !== 'driver' && profile.is_driver !== true) {
      return json(409, { error: 'A company membership is required for this billing plan.' });
    }
  }

  let existingQuery = supabaseAdmin
    .from('platform_membership_subscriptions')
    .select('id, user_id, plan_id, stripe_customer_id, stripe_subscription_id, status, trial_started_at, trial_ends_at');
  existingQuery = companyId
    ? existingQuery.eq('company_id', companyId)
    : existingQuery.eq('user_id', authData.user.id).is('company_id', null);
  const { data: existingData, error: existingError } = await existingQuery.maybeSingle();
  if (existingError && ['PGRST205', '42P01'].includes(existingError.code ?? '')) {
    return json(503, { error: 'Membership billing schema is not available yet.', migrationRequired: true });
  }
  if (existingError) return json(500, { error: existingError.message });

  const existing = existingData as ExistingSubscription | null;
  if (existing?.stripe_subscription_id && ['trialing', 'active', 'past_due', 'unpaid'].includes(String(existing.status))) {
    return json(409, { error: 'This account already has a subscription lifecycle.' });
  }

  if (existing?.status === 'trialing' && existing.plan_id !== planId) {
    return json(409, {
      error: 'The active free-trial plan cannot be changed during Checkout. Update the membership plan separately first.',
      currentPlanId: existing.plan_id,
    });
  }

  let customerId = existing?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    try {
      const customer = await stripeRequest<StripeCustomer>('/customers', {
        params: {
          email: authData.user.email ?? undefined,
          'metadata[xdrive_user_id]': authData.user.id,
          'metadata[xdrive_company_id]': companyId ?? '',
        },
        idempotencyKey: `xdrive-membership-customer:${companyId ?? authData.user.id}`,
      });
      customerId = customer.id;
    } catch (reason) {
      return stripeFailureResponse(reason, 'customer creation');
    }
  }

  const now = new Date();
  // Preserve any existing future trial end across Checkout retries. A failed or cancelled
  // Checkout must never restart, shorten, or silently discard the original free period.
  const preservedTrialEnd = parseFutureTrialEnd(existing?.trial_ends_at, now);
  const trialEnd = preservedTrialEnd ?? (existing ? null : addCalendarMonths(now, 3));
  const trialStartedAt = preservedTrialEnd
    ? existing?.trial_started_at ?? now.toISOString()
    : existing
      ? existing.trial_started_at
      : now.toISOString();

  let priceId: string;
  try {
    priceId = getStripePriceId(planId);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unknown Stripe price configuration failure.';
    console.error('[billing checkout] price configuration failed', { planId, message });
    return json(503, {
      error: 'Stripe membership price is not configured.',
      operation: 'price configuration',
      configurationRequired: true,
    });
  }

  const acceptedAt = now.toISOString();
  const recordStatus = preservedTrialEnd ? 'trialing' : 'pending';
  const record = {
    user_id: authData.user.id,
    company_id: companyId,
    plan_id: planId,
    status: recordStatus,
    trial_started_at: trialStartedAt,
    trial_ends_at: trialEnd?.toISOString() ?? existing?.trial_ends_at ?? null,
    stripe_customer_id: customerId,
    contract_terms_version: TERMS_VERSION,
    contract_accepted_at: acceptedAt,
    updated_at: acceptedAt,
  };

  const recordResult = existing?.id
    ? await supabaseAdmin.from('platform_membership_subscriptions').update(record).eq('id', existing.id)
    : await supabaseAdmin.from('platform_membership_subscriptions').insert(record);
  if (recordResult.error) return json(500, { error: recordResult.error.message });

  const origin = getCanonicalSiteOrigin();
  const checkoutParams: Record<string, string | number | boolean | undefined> = {
    mode: 'subscription',
    customer: customerId,
    'customer_update[address]': 'auto',
    payment_method_collection: 'always',
    billing_address_collection: 'required',
    'automatic_tax[enabled]': true,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    'subscription_data[metadata][xdrive_user_id]': authData.user.id,
    'subscription_data[metadata][xdrive_company_id]': companyId ?? '',
    'subscription_data[metadata][xdrive_plan_id]': planId,
    'subscription_data[metadata][xdrive_terms_version]': TERMS_VERSION,
    'metadata[xdrive_user_id]': authData.user.id,
    'metadata[xdrive_company_id]': companyId ?? '',
    'metadata[xdrive_plan_id]': planId,
    success_url: `${origin}/settings/billing?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings/billing?subscription=cancelled`,
  };
  if (trialEnd) {
    checkoutParams['subscription_data[trial_end]'] = Math.floor(trialEnd.getTime() / 1000);
  }

  let session: CheckoutSession;
  try {
    session = await stripeRequest<CheckoutSession>('/checkout/sessions', {
      idempotencyKey: `xdrive-membership-checkout:v2:${companyId ?? authData.user.id}:${planId}:${trialEnd?.toISOString() ?? 'no-trial'}`,
      params: checkoutParams,
    });
  } catch (reason) {
    return stripeFailureResponse(reason, 'Checkout Session creation');
  }
  if (!session.url) return json(502, { error: 'Stripe did not return a Checkout URL.' });

  const checkoutRecordResult = existing?.id
    ? await supabaseAdmin.from('platform_membership_subscriptions').update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : companyId
      ? await supabaseAdmin.from('platform_membership_subscriptions').update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }).eq('company_id', companyId)
      : await supabaseAdmin.from('platform_membership_subscriptions').update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }).eq('user_id', authData.user.id).is('company_id', null);
  if (checkoutRecordResult.error) return json(500, { error: checkoutRecordResult.error.message });

  return json(200, {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    trialEndsAt: trialEnd?.toISOString() ?? null,
    trialCalendarMonths: trialEnd ? 3 : 0,
    trialPreserved: Boolean(preservedTrialEnd),
    termsVersion: TERMS_VERSION,
  });
}
