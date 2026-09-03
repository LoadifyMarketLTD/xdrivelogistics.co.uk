import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { membershipHasCapability, resolveMembershipRole } from '../../../../../lib/membershipRole';
import { getCanonicalSiteOrigin } from '../../../../../lib/siteUrl';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { isStripeServerConfigured, stripeRequest } from '../../../_lib/stripeServer';

const requestSchema = z.object({ invoiceId: z.string().uuid() });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type CheckoutSession = { id: string; url: string | null; payment_status?: string };

const toMinorUnits = (amount: unknown) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
};

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

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, job_id, buyer_company_id, supplier_company_id, client_email, amount, currency, status, payment_status')
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

  const { data: connected, error: connectedError } = await supabaseAdmin
    .from('stripe_connected_accounts')
    .select('stripe_account_id, charges_enabled, payouts_enabled')
    .eq('company_id', invoice.supplier_company_id)
    .maybeSingle();
  if (connectedError && ['PGRST205', '42P01'].includes(connectedError.code ?? '')) {
    return json(503, { error: 'Stripe Connect schema is not available yet.', migrationRequired: true });
  }
  if (connectedError) return json(500, { error: connectedError.message });
  if (!connected?.stripe_account_id || !connected.charges_enabled || !connected.payouts_enabled) {
    return json(409, { error: 'The carrier has not completed Stripe payment and payout onboarding.' });
  }

  const amountPence = toMinorUnits(invoice.amount);
  if (!amountPence) return json(409, { error: 'Invoice amount is invalid.' });
  const currency = String(invoice.currency ?? 'GBP').toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) return json(409, { error: 'Invoice currency is invalid.' });

  const origin = getCanonicalSiteOrigin();
  const session = await stripeRequest<CheckoutSession>('/checkout/sessions', {
    connectedAccount: connected.stripe_account_id,
    idempotencyKey: `xdrive-job-payment:${invoice.id}`,
    params: {
      mode: 'payment',
      success_url: `${origin}/finance/invoices/${invoice.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/finance/invoices/${invoice.id}?payment=cancelled`,
      customer_email: typeof invoice.client_email === 'string' ? invoice.client_email : authData.user.email ?? undefined,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': amountPence,
      'line_items[0][price_data][product_data][name]': `XDrive transport invoice ${invoice.invoice_number ?? invoice.id}`,
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

  const { error: recordError } = await supabaseAdmin.from('stripe_job_payments').upsert({
    invoice_id: invoice.id,
    job_id: invoice.job_id,
    buyer_company_id: invoice.buyer_company_id,
    supplier_company_id: invoice.supplier_company_id,
    stripe_connected_account_id: connected.stripe_account_id,
    stripe_checkout_session_id: session.id,
    amount_minor: amountPence,
    currency,
    status: 'checkout_created',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'invoice_id' });
  if (recordError) return json(500, { error: recordError.message });

  return json(200, {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    paymentModel: 'stripe_connect_direct_charge',
    platformCustodiesFunds: false,
    xdriveApplicationFee: 0,
  });
}
