import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyStripeWebhookSignature } from '../../../_lib/stripeServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

const metadataValue = (object: Record<string, unknown>, key: string) => {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
};

const stripeTimestamp = (value: unknown) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
};

const isFutureTimestamp = (value: string | null | undefined) => {
  if (!value) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now();
};

async function finishEvent(eventId: string, status: 'processed' | 'ignored' | 'failed', errorMessage?: string | null) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('stripe_webhook_events').update({
    processing_status: status,
    error_message: errorMessage ?? null,
    processed_at: new Date().toISOString(),
  }).eq('stripe_event_id', eventId);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server database is not configured.' });
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET?.trim();
  if (!secret) return json(503, { error: 'Stripe Billing webhook is not configured.' });

  const rawBody = await request.text();
  if (!verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'), secret)) {
    return json(400, { error: 'Invalid Stripe signature.' });
  }

  let event: StripeEvent;
  try { event = JSON.parse(rawBody) as StripeEvent; }
  catch { return json(400, { error: 'Invalid Stripe event payload.' }); }
  if (!event.id?.startsWith('evt_') || !event.type || !event.data?.object) return json(400, { error: 'Malformed Stripe event.' });

  const { error: eventError } = await supabaseAdmin.from('stripe_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    connected_account_id: null,
    livemode: Boolean(event.livemode),
    processing_status: 'processing',
  });
  if (eventError?.code === '23505') {
    const { data: prior } = await supabaseAdmin.from('stripe_webhook_events').select('processing_status').eq('stripe_event_id', event.id).maybeSingle();
    if (prior?.processing_status === 'processed' || prior?.processing_status === 'ignored') return json(200, { received: true, duplicate: true });
  } else if (eventError) {
    return json(503, { error: eventError.message, migrationRequired: ['PGRST205', '42P01'].includes(eventError.code ?? '') });
  }

  const object = event.data.object;
  try {
    if (event.type === 'checkout.session.completed' && object.mode === 'subscription') {
      const userId = metadataValue(object, 'xdrive_user_id');
      const companyId = metadataValue(object, 'xdrive_company_id');
      const planId = metadataValue(object, 'xdrive_plan_id');
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : null;
      const customerId = typeof object.customer === 'string' ? object.customer : null;
      if (!userId || !planId || !subscriptionId || !customerId) throw new Error('Subscription checkout metadata is incomplete.');

      let lookup = supabaseAdmin.from('platform_membership_subscriptions')
        .select('id, plan_id, trial_ends_at');
      lookup = companyId
        ? lookup.eq('company_id', companyId)
        : lookup.eq('user_id', userId).is('company_id', null);
      const { data: membershipRow, error: lookupError } = await lookup.maybeSingle();
      if (lookupError) throw lookupError;
      if (!membershipRow) throw new Error('Membership lifecycle row was not found for completed Checkout.');
      if (membershipRow.plan_id !== planId) throw new Error('Completed Checkout plan does not match the membership lifecycle row.');

      const { error } = await supabaseAdmin.from('platform_membership_subscriptions').update({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_checkout_session_id: typeof object.id === 'string' ? object.id : null,
        status: isFutureTimestamp(membershipRow.trial_ends_at) ? 'trialing' : 'pending',
        updated_at: new Date().toISOString(),
      }).eq('id', membershipRow.id);
      if (error) throw error;
      await finishEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscriptionId = typeof object.id === 'string' ? object.id : null;
      if (!subscriptionId) throw new Error('Stripe subscription id is missing.');
      const rawStatus = event.type === 'customer.subscription.deleted' ? 'canceled' : String(object.status ?? 'pending');
      const status = rawStatus === 'canceled' ? 'cancelled' : rawStatus;
      const allowed = new Set(['pending','trialing','active','past_due','unpaid','paused','cancelled','incomplete','incomplete_expired']);
      const normalizedStatus = allowed.has(status) ? status : 'pending';
      const stripeTrialEnd = stripeTimestamp(object.trial_end);
      const updateRecord: Record<string, unknown> = {
        status: normalizedStatus,
        stripe_customer_id: typeof object.customer === 'string' ? object.customer : undefined,
        current_period_end: stripeTimestamp(object.current_period_end),
        cancel_at_period_end: Boolean(object.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      };
      // Preserve the historical launch-trial end after Stripe leaves trial mode.
      if (stripeTrialEnd) updateRecord.trial_ends_at = stripeTrialEnd;

      const { error } = await supabaseAdmin.from('platform_membership_subscriptions').update(updateRecord).eq('stripe_subscription_id', subscriptionId);
      if (error) throw error;
      await finishEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : null;
      if (subscriptionId) {
        let nextStatus = event.type === 'invoice.payment_failed' ? 'past_due' : 'active';
        if (event.type === 'invoice.paid') {
          const { data: row, error: rowError } = await supabaseAdmin
            .from('platform_membership_subscriptions')
            .select('status, trial_ends_at')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();
          if (rowError) throw rowError;
          if (row?.status === 'trialing' && isFutureTimestamp(row.trial_ends_at)) nextStatus = 'trialing';
        }
        const { error } = await supabaseAdmin.from('platform_membership_subscriptions').update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscriptionId);
        if (error) throw error;
      }
      await finishEvent(event.id, 'processed');
      return json(200, { received: true });
    }

    await finishEvent(event.id, 'ignored');
    return json(200, { received: true, ignored: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Stripe Billing event processing failed.';
    await finishEvent(event.id, 'failed', message);
    return json(500, { error: message });
  }
}
