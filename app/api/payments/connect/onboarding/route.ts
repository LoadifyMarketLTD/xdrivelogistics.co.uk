import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripeOnboardingFailure } from '../../../../../lib/stripeOnboardingFailure';
import { XDRIVE_LOGISTICS_COMPANY_ID } from '../../../../../lib/activeWorkspace';

import { getCanonicalSiteOrigin } from '../../../../../lib/siteUrl';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { isStripeServerConfigured, stripeRequest } from '../../../_lib/stripeServer';
import { listStripeSetupCompanies } from '../../../_lib/stripeSetupAccess';
import { getStripeCommercialReadiness } from '../../../_lib/stripeCommercialReadiness';

const requestSchema = z.object({ companyId: z.string().uuid(), action: z.enum(['start', 'refresh']).default('start') });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

type StripeAccountLink = { url: string; expires_at: number };

async function createCompanyOnboarding(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  if (!isStripeServerConfigured) return json(503, { error: 'Stripe is not configured.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid request.' });
  const { companyId } = parsed.data;

  const companies = await listStripeSetupCompanies(supabaseAdmin, authData.user.id);
  const company = companies.find(candidate => candidate.companyId === companyId);
  if (!company) return json(403, { error: 'Only an authorised company owner/admin or its own pending applicant can configure Stripe.', code: 'STRIPE_SETUP_COMPANY_FORBIDDEN' });

  if (companyId === XDRIVE_LOGISTICS_COMPANY_ID) {
    const platformAccount = await stripeRequest<StripeAccount>('/account', { method: 'GET' });
    const active = platformAccount.details_submitted === true && platformAccount.charges_enabled === true && platformAccount.payouts_enabled === true;
    return json(active ? 409 : 503, {
      error: active
        ? 'XDrive Logistics LTD already uses the active XDrive platform Stripe account. A separate Connected Account must not be created for this company.'
        : 'The XDrive platform Stripe account requires attention before this company can use payments.',
      code: active ? 'PLATFORM_STRIPE_ACCOUNT_IN_USE' : 'PLATFORM_STRIPE_ACCOUNT_NOT_READY',
    });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('stripe_connected_accounts')
    .select('stripe_account_id, onboarding_status')
    .eq('company_id', companyId)
    .maybeSingle();
  if (existingError && existingError.code !== 'PGRST205' && existingError.code !== '42P01') {
    return json(500, { error: existingError.message });
  }
  if (existingError) {
    return json(503, { error: 'Stripe Connect schema is not available yet.', migrationRequired: true });
  }

  let account: StripeAccount;
  if (existing?.stripe_account_id) {
    account = await stripeRequest<StripeAccount>(`/accounts/${existing.stripe_account_id}`, { method: 'GET' });
  } else {
    if (parsed.data.action === 'refresh') return json(200, { stripeReady: false, onboardingStatus: 'not_started' });
    account = await stripeRequest<StripeAccount>('/accounts', {
      params: {
        country: 'GB',
        email: authData.user.email ?? undefined,
        'controller[fees][payer]': 'account',
        'controller[losses][payments]': 'stripe',
        'controller[requirement_collection]': 'stripe',
        'controller[stripe_dashboard][type]': 'full',
        'metadata[xdrive_company_id]': companyId,
        'metadata[xdrive_company_name]': typeof company.name === 'string' ? company.name : undefined,
      },
      idempotencyKey: `xdrive-connect-account:${companyId}`,
    });

  }

  // A return URL is not evidence of completion: persist only Stripe's response.
  const ready = account.details_submitted === true && account.charges_enabled === true && account.payouts_enabled === true;
  const onboardingStatus = ready ? 'enabled' : account.details_submitted ? 'submitted' : 'pending';
  const { error: saveError } = await supabaseAdmin.from('stripe_connected_accounts').upsert({
    company_id: companyId, stripe_account_id: account.id, account_type: 'standard',
    onboarding_status: onboardingStatus, details_submitted: Boolean(account.details_submitted),
    charges_enabled: Boolean(account.charges_enabled), payouts_enabled: Boolean(account.payouts_enabled),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id' });
  if (saveError) return json(500, { error: 'Stripe account state could not be saved.' });
  if (parsed.data.action === 'refresh') return json(200, { stripeReady: ready, onboardingStatus });

  const origin = getCanonicalSiteOrigin();
  const accountLink = await stripeRequest<StripeAccountLink>('/account_links', {
    params: {
      account: account.id,
      refresh_url: `${origin}/settings/payments?connect=refresh&companyId=${companyId}`,
      return_url: `${origin}/settings/payments?connect=return&companyId=${companyId}`,
      type: 'account_onboarding',
    },
    idempotencyKey: `xdrive-connect-link:${companyId}:${Math.floor(Date.now() / 60000)}`,
  });

  return json(200, {
    onboardingUrl: accountLink.url,
    expiresAt: accountLink.expires_at,
    connectedAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
  });
}

export async function POST(request: NextRequest) {
  try {
    return await createCompanyOnboarding(request);
  } catch (reason) {
    const failure = stripeOnboardingFailure(reason);
    const diagnostic = reason instanceof Error
      ? {
          message: reason.message,
          stripeCode: 'stripeCode' in reason ? String((reason as Error & { stripeCode?: unknown }).stripeCode ?? '') : '',
          status: 'status' in reason ? Number((reason as Error & { status?: unknown }).status ?? 0) : 0,
        }
      : { message: String(reason ?? ''), stripeCode: '', status: 0 };
    console.error('[stripe.onboarding]', { code: failure.code, ...diagnostic });
    return json(failure.status, { error: failure.error, code: failure.code });
  }
}
/** Read-only setup discovery; never creates an account or an account link. */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Sign in to configure your company payments.' });
  const { data: auth, error } = await (supabaseValidator ?? supabaseAdmin).auth.getUser(token);
  if (error || !auth.user) return json(401, { error: 'Your session expired. Please sign in again.' });
  try {
    const companies = await listStripeSetupCompanies(supabaseAdmin, auth.user.id);
    const output = await Promise.all(companies.map(async company => {
      const state = await getStripeCommercialReadiness(supabaseAdmin!, company.companyId);
      if (!state.infrastructureAvailable) throw new Error('Stripe account status is temporarily unavailable.');
      return { ...company, stripeReady: state.ready, onboardingStatus: state.onboardingStatus ?? 'not_started' };
    }));
    return json(200, { companies: output });
  } catch (reason) {
    console.error('[stripe.setup-discovery]', reason instanceof Error ? reason.message : 'Unknown failure');
    return json(503, { error: 'Company payment setup could not be verified. Please retry.' });
  }
}
