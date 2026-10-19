import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { membershipHasCapability, resolveMembershipRole } from '../../../../../lib/membershipRole';
import { XDRIVE_LOGISTICS_COMPANY_ID } from '../../../../../lib/activeWorkspace';
import { getCanonicalSiteOrigin } from '../../../../../lib/siteUrl';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { isStripeServerConfigured, stripeRequest } from '../../../_lib/stripeServer';

const requestSchema = z.object({
  invoiceId: z.string().uuid(),
  returnPath: z.string().trim().max(500).optional(),
});
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const safePaymentReturnPath = (value: string | undefined, invoiceId: string) => {
  const fallback = `/admin/finance/carrier-invoices/${invoiceId}`;
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  const allowedPrefixes = ['/admin/finance/carrier-invoices/', '/broker/carrier-costs/', '/customer/invoices/'];
  return allowedPrefixes.some((prefix) => value.startsWith(prefix)) ? value : fallback;
};

type CheckoutSession = { id: string; url: string | null; payment_status?: string };

export async function POST(request: NextRequest) {
  try {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  if (!isStripeServerConfigured) return json(503, { error: 'Stripe is not configured.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Invalid request.' });

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, job_id, buyer_company_id, supplier_company_id, client_email, amount, currency, status, payment_status, approved_at')
    .eq('id', parsed.data.invoiceId)
    .maybeSingle();
  if (invoiceError) return json(500, { error: invoiceError.message });
  if (!invoice) return json(404, { error: 'Invoice not found.' });
  if (!invoice.buyer_company_id || !invoice.supplier_company_id) {
    return json(409, { error: 'Invoice is not bound to both buyer and supplier companies.' });
  }
  if (String(invoice.payment_status ?? '').toLowerCase() === 'paid') {
    return json(409, { error: 'Invoice is already paid.' });
  }
  if (!invoice.approved_at) {
    return json(409, { error: 'Invoice must be approved by the buyer before Stripe payment can start.' });
  }

  const { data: buyerMembership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('company_id', invoice.buyer_company_id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return json(500, { error: membershipError.message });
  const buyerRole = resolveMembershipRole(buyerMembership?.role_in_company ?? null);
  if (!buyerMembership || !buyerRole || !membershipHasCapability(buyerRole, 'payments.manage')) {
    return json(403, { error: 'Payments authority is required for this buyer company.' });
  }

  if (!['approved', 'submitted', 'sent', 'overdue'].includes(String(invoice.status).toLowerCase())) return json(409, { error: 'Invoice is not payable in its current state.' });

  const supplierIsPlatform = invoice.supplier_company_id === XDRIVE_LOGISTICS_COMPANY_ID;
  let stripeAccountId: string | null = null;
  if (supplierIsPlatform) {
    const platformAccount = await stripeRequest<{ id: string; charges_enabled?: boolean; payouts_enabled?: boolean }>('/account', { method: 'GET' });
    if (!platformAccount.id || platformAccount.charges_enabled !== true || platformAccount.payouts_enabled !== true) {
      return json(409, { error: 'XDrive platform Stripe payments are not fully active.' });
    }
    stripeAccountId = platformAccount.id;
  } else {
    const { data: connected, error: connectedError } = await supabaseAdmin
      .from('stripe_connected_accounts')
      .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted')
      .eq('company_id', invoice.supplier_company_id)
      .maybeSingle();
    if (connectedError && ['PGRST205', '42P01'].includes(connectedError.code ?? '')) {
      return json(503, { error: 'Stripe Connect schema is not available yet.', migrationRequired: true });
    }
    if (connectedError) return json(500, { error: connectedError.message });
    if (!connected?.stripe_account_id || !connected.charges_enabled || !connected.payouts_enabled || !connected.details_submitted) {
      return json(409, { error: 'The carrier has not completed Stripe payment and payout onboarding.' });
    }
    stripeAccountId = connected.stripe_account_id;
  }

  const origin = getCanonicalSiteOrigin();
  const returnPath = safePaymentReturnPath(parsed.data.returnPath, invoice.id);
  const { data: attempt, error: reserveError } = await supabaseAdmin.rpc('prepare_invoice_stripe_attempt', {
    p_invoice: invoice.id, p_user: authData.user.id, p_account: stripeAccountId,
    p_live: /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? ''), p_return_path: returnPath,
  });
  if (reserveError || !attempt?.id) return json(409, { error: reserveError?.message ?? 'Payment reservation failed.' });
  if (attempt.status === 'processing') return json(409, { error: 'A payment is still processing. Wait for confirmation.' });
  if (attempt.session_id) {
    const existing = await stripeRequest<CheckoutSession & { status?: string }>(`/checkout/sessions/${encodeURIComponent(attempt.session_id)}`, { method: 'GET', connectedAccount: supplierIsPlatform ? null : stripeAccountId });
    if (existing.status === 'open' && existing.url) return json(200, { checkoutUrl: existing.url, checkoutSessionId: existing.id, replayed: true });
    return json(409, { error: 'The existing Checkout requires webhook reconciliation before another payment.' });
  }
  const amountPence = Number(attempt.amount_minor);
  const currency = String(attempt.currency);
  const session = await stripeRequest<CheckoutSession>('/checkout/sessions', {
    connectedAccount: supplierIsPlatform ? null : stripeAccountId,
    idempotencyKey: `xdrive-job-payment:${attempt.id}`,
    params: {
      mode: 'payment',
      success_url: `${origin}${attempt.return_path}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${attempt.return_path}?payment=cancelled`,
      customer_email: attempt.customer_email ?? undefined,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': amountPence,
      'line_items[0][price_data][product_data][name]': `XDrive transport invoice ${invoice.invoice_number ?? invoice.id}`,
      'metadata[xdrive_attempt_id]': attempt.id,
      'payment_intent_data[metadata][xdrive_attempt_id]': attempt.id,
      'metadata[xdrive_invoice_id]': invoice.id,
      'metadata[xdrive_job_id]': invoice.job_id ?? '',
      'metadata[xdrive_buyer_company_id]': invoice.buyer_company_id,
      'metadata[xdrive_supplier_company_id]': invoice.supplier_company_id,
      'payment_intent_data[metadata][xdrive_invoice_id]': invoice.id,
      'payment_intent_data[metadata][xdrive_job_id]': invoice.job_id ?? '',
      'payment_intent_data[metadata][xdrive_buyer_company_id]': invoice.buyer_company_id,
      'payment_intent_data[metadata][xdrive_supplier_company_id]': invoice.supplier_company_id,
    },
  });

  if (!session.url) return json(502, { error: 'Stripe did not return a Checkout URL.' });

  const { error: recordError } = await supabaseAdmin.rpc('bind_invoice_stripe_session', {
    p_attempt: attempt.id, p_session: session.id, p_url: session.url,
  });
  if (recordError) return json(503, { error: 'Checkout exists but could not be recorded. Retry safely; do not create another payment.' });

  return json(200, {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    paymentModel: supplierIsPlatform ? 'stripe_platform_direct_charge' : 'stripe_connect_direct_charge',
    platformCustodiesFunds: false,
    xdriveApplicationFee: 0,
  });
  } catch (reason) {
    return json(502, { error: reason instanceof Error ? reason.message : 'Stripe request failed. Retry the same payment attempt.' });
  }
}
