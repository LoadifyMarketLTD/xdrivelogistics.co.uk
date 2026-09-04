import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCanonicalSiteOrigin } from '../../../../lib/siteUrl';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { isStripeServerConfigured, stripeRequest } from '../../_lib/stripeServer';

const COMPANY_BILLING_ROLES = new Set(['owner', 'admin']);
const requestSchema = z.object({ companyId: z.string().uuid().nullable().optional() });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
type PortalSession = { id: string; url: string };

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  if (!isStripeServerConfigured) return json(503, { error: 'Stripe is not configured.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: 'Invalid request.' });
  const companyId = parsed.data.companyId ?? null;

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
      return json(403, { error: 'Only a company owner or admin can manage membership billing.' });
    }
  }

  let query = supabaseAdmin.from('platform_membership_subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status');
  query = companyId
    ? query.eq('company_id', companyId)
    : query.eq('user_id', authData.user.id).is('company_id', null);
  const { data: subscription, error } = await query.maybeSingle();
  if (error && ['PGRST205', '42P01'].includes(error.code ?? '')) return json(503, { error: 'Membership billing schema is not available yet.', migrationRequired: true });
  if (error) return json(500, { error: error.message });
  if (!subscription?.stripe_customer_id) return json(409, { error: 'No Stripe billing profile exists for this account.' });

  const portal = await stripeRequest<PortalSession>('/billing_portal/sessions', {
    params: {
      customer: subscription.stripe_customer_id,
      return_url: `${getCanonicalSiteOrigin()}/settings/billing`,
    },
    idempotencyKey: `xdrive-billing-portal:${companyId ?? authData.user.id}:${Math.floor(Date.now() / 60000)}`,
  });

  return json(200, { portalUrl: portal.url });
}
