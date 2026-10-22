import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyStripeWebhookSignature, stripeRequest } from '../../../_lib/stripeServer';

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
  }).eq('stripe_event_id', eventId).in('processing_status', ['processing', 'failed']);
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

  if (typeof event.livemode !== 'boolean' || event.livemode !== /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')) return json(400, { error: 'Stripe event mode does not match this environment.' });

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

    const paymentEvents = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired', 'payment_intent.payment_failed', 'charge.dispute.created', 'charge.dispute.closed', 'charge.refunded'];
    if (paymentEvents.includes(event.type)) {
      if ((event.type.startsWith('checkout.session.') || event.type.startsWith('payment_intent.')) && !metadataValue(object, 'xdrive_invoice_id')) {
        await markEvent(event.id, 'ignored');
        return json(200, { received: true, ignored: true });
      }
      if (event.type.startsWith('charge.')) {
        const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : null;
        if (!paymentIntentId) { await markEvent(event.id, 'ignored'); return json(200, { received: true, ignored: true }); }
        const intent = await stripeRequest<{ metadata?: Record<string, string> }>(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, { method: 'GET', connectedAccount: event.account ?? null });
        if (!intent.metadata?.xdrive_invoice_id) { await markEvent(event.id, 'ignored'); return json(200, { received: true, ignored: true }); }
      }
      let verifiedPlatformAccount: string | undefined;
      if (!event.account) {
        const account = await stripeRequest<{ id: string }>('/account', { method: 'GET' });
        verifiedPlatformAccount = account.id;
      }
      const { data, error } = await supabaseAdmin.rpc('apply_invoice_stripe_event', {
        p_event: { ...event, xdrive_verified_platform_account: verifiedPlatformAccount },
        p_expected_live: /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? ''),
      });
      if (error) throw new Error(error.message);

      const rpcResult = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const successfulCheckout = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
        && String(object.payment_status ?? '') === 'paid'
        && rpcResult.duplicate_payment !== true;
      if (successfulCheckout) {
        const invoiceId = metadataValue(object, 'xdrive_invoice_id');
        const amountTotal = Number(object.amount_total ?? 0);
        const currency = String(object.currency ?? 'gbp').toUpperCase();
        const externalReference = typeof object.payment_intent === 'string'
          ? object.payment_intent
          : typeof object.id === 'string'
            ? object.id
            : null;
        if (invoiceId && Number.isFinite(amountTotal) && amountTotal > 0) {
          const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('invoices')
            .select('id, company_id')
            .eq('id', invoiceId)
            .maybeSingle();
          if (invoiceError) throw invoiceError;
          if (invoice?.company_id) {
            const paidAt = new Date().toISOString();
            const { error: notificationError } = await supabaseAdmin.from('notification_events').insert({
              event_type: 'payment_received',
              entity_type: 'invoice',
              entity_id: invoiceId,
              company_id: invoice.company_id,
              recipient_user_id: null,
              idempotency_key: `payment_received:stripe:${externalReference ?? event.id}`,
              payload: {
                invoice_id: invoiceId,
                company_id: invoice.company_id,
                amount: amountTotal / 100,
                currency,
                paid_at: paidAt,
                settlement_method: 'card',
                external_reference: externalReference,
              },
            });
            if (notificationError && notificationError.code !== '23505') {
              console.error('[stripe-connect] Could not enqueue payment receipt notification', notificationError.message);
            }
          }
        }
      }

      return json(200, data ?? { received: true });
    }

    await markEvent(event.id, 'ignored');
    return json(200, { received: true, ignored: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Stripe event processing failed.';
    await markEvent(event.id, 'failed', message);
    return json(500, { error: message });
  }
}
