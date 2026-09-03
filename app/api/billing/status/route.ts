import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const COMPANY_BILLING_ROLES = new Set(['owner', 'admin']);
const querySchema = z.object({ companyId: z.string().uuid().nullable().optional() });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const companyIdParam = request.nextUrl.searchParams.get('companyId');
  const parsed = querySchema.safeParse({ companyId: companyIdParam || null });
  if (!parsed.success) return json(400, { error: 'Invalid billing account.' });
  const companyId = parsed.data.companyId ?? null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError) return json(500, { error: profileError.message });
  if (!profile || String(profile.status ?? '').toLowerCase() !== 'active') return json(403, { error: 'Active account required.' });

  if (String(profile.role ?? '').toLowerCase() === 'owner') {
    return json(200, { excluded: true, delegated: false, reason: 'platform_owner', subscription: null });
  }

  if (companyId) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status')
      .eq('company_id', companyId)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) return json(500, { error: membershipError.message });
    if (!membership || !COMPANY_BILLING_ROLES.has(String(membership.role_in_company ?? '').toLowerCase())) {
      return json(403, { error: 'Only a company owner or admin can view membership billing.' });
    }
  } else {
    const { data: activeMemberships, error: activeMembershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('company_id, role_in_company')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .limit(1);
    if (activeMembershipError) return json(500, { error: activeMembershipError.message });
    if ((activeMemberships ?? []).length > 0) {
      return json(200, {
        excluded: false,
        delegated: true,
        reason: 'company_billing_managed_by_owner_admin',
        subscription: null,
      });
    }
  }

  let query = supabaseAdmin
    .from('platform_membership_subscriptions')
    .select('plan_id, status, trial_started_at, trial_ends_at, current_period_end, cancel_at_period_end, contract_terms_version, contract_accepted_at, stripe_customer_id, stripe_subscription_id');
  query = companyId
    ? query.eq('company_id', companyId)
    : query.eq('user_id', authData.user.id).is('company_id', null);

  const { data: subscription, error } = await query.maybeSingle();
  if (error && ['PGRST205', '42P01'].includes(error.code ?? '')) {
    return json(503, { error: 'Membership billing schema is not available yet.', migrationRequired: true });
  }
  if (error) return json(500, { error: error.message });

  if (!subscription) {
    return json(200, { excluded: false, delegated: false, reason: 'membership_missing', subscription: null });
  }

  return json(200, {
    excluded: false,
    delegated: false,
    reason: null,
    subscription: {
      planId: subscription.plan_id,
      status: subscription.status,
      trialStartedAt: subscription.trial_started_at,
      trialEndsAt: subscription.trial_ends_at,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      termsVersion: subscription.contract_terms_version,
      contractAcceptedAt: subscription.contract_accepted_at,
      hasStripeCustomer: Boolean(subscription.stripe_customer_id),
      hasStripeSubscription: Boolean(subscription.stripe_subscription_id),
    },
  });
}
