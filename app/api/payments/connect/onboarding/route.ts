import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCanonicalSiteOrigin } from '../../../../../lib/siteUrl';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { isStripeServerConfigured, stripeRequest } from '../../../_lib/stripeServer';

const requestSchema = z.object({ companyId: z.string().uuid() });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

type StripeAccountLink = { url: string; expires_at: number };

export async function POST(request: NextRequest) {
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

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return json(500, { error: membershipError.message });
  if (!membership) return json(403, { error: 'You do not have an active membership for this company.' });

  const allowedRoles = new Set(['owner', 'admin']);
  if (!allowedRoles.has(String(membership.role_in_company ?? ''))) {
    return json(403, { error: 'Only a company owner or admin can configure Stripe payouts.' });
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (companyError) return json(500, { error: companyError.message });
  if (!company) return json(404, { error: 'Company not found.' });

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
    account = await stripeRequest<StripeAccount>('/accounts', {
      params: {
        type: 'standard',
        country: 'GB',
        email: authData.user.email ?? undefined,
        'metadata[xdrive_company_id]': companyId,
        'metadata[xdrive_company_name]': typeof company.name === 'string' ? company.name : undefined,
      },
      idempotencyKey: `xdrive-connect-account:${companyId}`,
    });

    const { error: saveError } = await supabaseAdmin.from('stripe_connected_accounts').upsert({
      company_id: companyId,
      stripe_account_id: account.id,
      account_type: 'standard',
      onboarding_status: account.details_submitted ? 'submitted' : 'pending',
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (saveError) return json(500, { error: saveError.message });
  }

  const origin = getCanonicalSiteOrigin();
  const accountLink = await stripeRequest<StripeAccountLink>('/account_links', {
    params: {
      account: account.id,
      refresh_url: `${origin}/settings/payments?connect=refresh`,
      return_url: `${origin}/settings/payments?connect=return`,
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
