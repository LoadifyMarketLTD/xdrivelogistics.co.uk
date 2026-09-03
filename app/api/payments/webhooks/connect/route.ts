import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyStripeWebhookSignature } from '../../../_lib/stripeServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type StripeEvent = {
  id: string;
  type: string;
  account?: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

const metadataValue = (object: Record<string, unknown>, key: string) => {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
};

async function markEvent(eventId: string, status: 'processed' | 'ignored' | 'failed', errorMessage?: string | null) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('stripe_webhook_events').update({
    processing_status: status,
    error_message: errorMessage ?? null,
    processed_at: new Date().toISOString(),
  }).eq('stripe_event_id', eventId);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server database is not configured.' });
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return json(503, { error: 'Stripe Connect webhook is not configured.' });

  const rawBody = await request.text();
  if (!verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'), webhookSecret)) {
    return json(400, { error: 'Invalid Stripe signature.' });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return json(400, { error: 'Invalid Stripe event payload.' });
  }
  if (!event.id?.startsWith('evt_') || !event.type || !event.data?.object) {
    return json(400, { error: 'Malformed Stripe event.' });
  }

  const { error: eventInsertError } = await supabaseAdmin.from('stripe_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    connected_account_id: event.account ?? null,
    livemode: Boolean(event.livemode),
    processing_status: 'processing',
  });
  if (eventInsertError?.code === '23505') {
    const { data: prior } = await supabaseAdmin.from('stripe_webhook_events')
      .select('processing_status')
      .eq('stripe_event_id', event.id)
      .maybeSingle();
    if (prior?.processing_status === 'processed' || prior?.processing_status === 'ignored') {
      return json(200, { received: true, duplicate: true });
    }
  } else if (eventInsertError) {
    return json(503, { error: eventInsertError.message, migrationRequired: ['PGRST205', '42P01'].includes(eventInsertError.code ?? '') });
  }

  const object = event.data.object;
  try {
    if (event.type === 'account.updated') {
      const accountId = typeof object.id === 'string' ? object.id : event.account ?? null;
      if (!accountId) throw new Error('Stripe account id is missing.');
      const requirements = object.requirements as Record<string, unknown> | undefined;
      const currentlyDue = Array.isArray(requirements?.currently_due) ? requirements.currently_due : [];
      const chargesEnabled = Boolean(object.charges_enabled);
      const payoutsEnabled = Boolean(object.payouts_enabled);
      const detailsSubmitted = Boolean(object.details_submitted);
      const onboardingStatus = chargesEnabled && payoutsEnabled
        ? 'enabled'
        : detailsSubmitted
          ? (currentlyDue.length ? 'restricted' : 'submitted')
          : 'pending';
      const { error } = await supabaseAdmin.from('stripe_connected_accounts').update({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
        requirements_due: currentlyDue,
        onboarding_status: onboardingStatus,
        updated_at: new Date().toISOString(),
      }).eq('stripe_account_id', accountId);
      if (error) throw error;
      await markEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    if (event.type === 'checkout.session.completed') {
      const invoiceId = metadataValue(object, 'xdrive_invoice_id');
      if (!invoiceId) {
        await markEvent(event.id, 'ignored');
        return json(200, { received: true, ignored: true });
      }
      if (String(object.payment_status ?? '') !== 'paid') {
        const { error } = await supabaseAdmin.from('stripe_job_payments').update({
          status: 'processing', last_stripe_event_id: event.id, updated_at: new Date().toISOString(),
        }).eq('invoice_id', invoiceId);
        if (error) throw error;
        await markEvent(event.id, 'processed');
        return json(200, { received: true });
      }

      const amountTotal = Number(object.amount_total ?? 0);
      if (!Number.isFinite(amountTotal) || amountTotal <= 0) throw new Error('Stripe amount_total is invalid.');
      const currency = String(object.currency ?? 'gbp').toUpperCase();
      const paymentIntent = typeof object.payment_intent === 'string' ? object.payment_intent : null;
      const checkoutSessionId = typeof object.id === 'string' ? object.id : null;

      const { data: invoice, error: invoiceError } = await supabaseAdmin.from('invoices')
        .select('id, company_id, amount, currency')
        .eq('id', invoiceId)
        .maybeSingle();
      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error('XDrive invoice referenced by Stripe does not exist.');
      const invoiceMinor = Math.round(Number(invoice.amount) * 100);
      if (invoiceMinor !== Math.round(amountTotal)) throw new Error('Stripe payment amount does not match the canonical invoice amount.');
      if (String(invoice.currency ?? 'GBP').toUpperCase() !== currency) throw new Error('Stripe payment currency does not match the canonical invoice currency.');

      const { error: paymentUpdateError } = await supabaseAdmin.from('stripe_job_payments').update({
        stripe_checkout_session_id: checkoutSessionId,
        stripe_payment_intent_id: paymentIntent,
        status: 'paid',
        paid_at: new Date().toISOString(),
        last_stripe_event_id: event.id,
        updated_at: new Date().toISOString(),
      }).eq('invoice_id', invoiceId);
      if (paymentUpdateError) throw paymentUpdateError;

      const { error: historyError } = await supabaseAdmin.from('invoice_payment_history').insert({
        invoice_id: invoiceId,
        company_id: invoice.company_id,
        recorded_by: null,
        amount: amountTotal / 100,
        currency,
        paid_at: new Date().toISOString(),
        settlement_method: 'card',
        external_reference: paymentIntent ?? checkoutSessionId,
        note: 'Verified Stripe Connect direct charge. Funds settled to the supplier connected account; XDrive did not custody transport funds.',
        idempotency_key: event.id,
      });
      if (historyError && historyError.code !== '23505') throw historyError;

      await markEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    if (event.type === 'checkout.session.expired') {
      const invoiceId = metadataValue(object, 'xdrive_invoice_id');
      if (invoiceId) {
        const { error } = await supabaseAdmin.from('stripe_job_payments').update({
          status: 'cancelled', last_stripe_event_id: event.id, updated_at: new Date().toISOString(),
        }).eq('invoice_id', invoiceId);
        if (error) throw error;
      }
      await markEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const invoiceId = metadataValue(object, 'xdrive_invoice_id');
      if (invoiceId) {
        const lastError = object.last_payment_error as Record<string, unknown> | undefined;
        const { error } = await supabaseAdmin.from('stripe_job_payments').update({
          status: 'failed',
          failure_code: typeof lastError?.code === 'string' ? lastError.code : null,
          failure_message: typeof lastError?.message === 'string' ? lastError.message : null,
          last_stripe_event_id: event.id,
          updated_at: new Date().toISOString(),
        }).eq('invoice_id', invoiceId);
        if (error) throw error;
      }
      await markEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    if (event.type === 'charge.dispute.created' || event.type === 'charge.refunded') {
      const paymentIntent = typeof object.payment_intent === 'string' ? object.payment_intent : null;
      if (paymentIntent) {
        const status = event.type === 'charge.dispute.created' ? 'disputed' : 'refunded';
        const timestampField = event.type === 'charge.dispute.created' ? { disputed_at: new Date().toISOString() } : { refunded_at: new Date().toISOString() };
        const { error } = await supabaseAdmin.from('stripe_job_payments').update({
          status,
          ...timestampField,
          last_stripe_event_id: event.id,
          updated_at: new Date().toISOString(),
        }).eq('stripe_payment_intent_id', paymentIntent);
        if (error) throw error;
      }
      await markEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    await markEvent(event.id, 'ignored');
    return json(200, { received: true, ignored: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Stripe event processing failed.';
    await markEvent(event.id, 'failed', message);
    return json(500, { error: message });
  }
}
