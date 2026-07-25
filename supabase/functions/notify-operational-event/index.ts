/**
 * Processes the notification_events queue.
 *
 * This function may be deployed with --no-verify-jwt only when every caller
 * supplies the private XDRIVE_NOTIFICATION_WEBHOOK_SECRET in the
 * x-xdrive-webhook-secret header. Configure the same header on the Supabase
 * Database Webhook or pg_cron request.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildExpoPushMessage,
  isExpoPushToken,
  parseExpoPushResponse,
  type PushNotificationPayload,
} from '../../../lib/pushNotifications.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://www.xdrivelogistics.co.uk').trim().replace(/\/$/, '');
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@xdrivelogistics.co.uk';
const webhookSecret = Deno.env.get('XDRIVE_NOTIFICATION_WEBHOOK_SECRET') ?? '';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface NotificationEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  company_id: string | null;
  recipient_user_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempt_count?: number;
  next_attempt_at?: string | null;
}

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const constantTimeEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const buildAppUrl = (path: string) => new URL(path, `${siteUrl}/`).toString();

const safeOnboardingUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return buildAppUrl('/onboarding/resume');
  try {
    const candidate = new URL(value.trim(), `${siteUrl}/`);
    const allowedOrigin = new URL(siteUrl).origin;
    if (candidate.origin !== allowedOrigin || !candidate.pathname.startsWith('/onboarding/')) {
      return buildAppUrl('/onboarding/resume');
    }
    return candidate.toString();
  } catch {
    return buildAppUrl('/onboarding/resume');
  }
};

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function getUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  const metadata = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return {
    email: data.user.email,
    name: metadata.full_name ?? metadata.name ?? data.user.email.split('@')[0],
  };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resendApiKey) {
    console.error(`[notify] RESEND_API_KEY is not configured; email not sent: ${subject}`);
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    console.error(`[notify] Resend rejected email: ${response.status} ${responseText.slice(0, 500)}`);
    return false;
  }
  return true;
}

async function getDriverPushTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, device_token')
    .eq('user_id', userId)
    .eq('app_access', true);

  if (error) throw error;
  return ((data ?? []) as Array<{ device_token: string | null }>)
    .map((row) => row.device_token?.trim() ?? '')
    .filter((token) => isExpoPushToken(token));
}

async function invalidateDriverPushTokens(tokens: string[]) {
  if (!tokens.length) return;
  const { error } = await supabase
    .from('drivers')
    .update({ device_token: null })
    .in('device_token', tokens);

  if (error) {
    console.error(`[notify] Failed to invalidate Expo push tokens: ${error.message}`);
  }
}

async function sendPushToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
  const tokens = await getDriverPushTokens(userId);
  if (!tokens.length) return true;

  if (!expoAccessToken) {
    console.warn('[notify] EXPO_ACCESS_TOKEN is not configured; skipping push delivery.');
    return true;
  }

  const expoAuthorizationHeader = 'Bearer ' + expoAccessToken;
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: expoAuthorizationHeader,
    },
    body: JSON.stringify(tokens.map((token) => buildExpoPushMessage(token, payload))),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`[notify] Expo push request failed: ${response.status}`);
    return false;
  }

  const result = parseExpoPushResponse(responseBody, tokens);
  if (result.invalidTokens.length > 0) {
    await invalidateDriverPushTokens(result.invalidTokens);
  }
  if (!result.ok && result.error) {
    console.error(`[notify] Expo push rejected notification: ${result.error}`);
  }
  return result.ok || !result.retryable;
}

async function emailCompanyOperators(
  companyId: string,
  subject: string,
  htmlFor: (safeName: string) => string,
): Promise<boolean> {
  const { data: members, error } = await supabase
    .from('company_memberships')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .eq('status', 'active');

  if (error) throw error;
  if (!members?.length) return true;

  const results = await Promise.allSettled(
    members.map(async (member: { user_id: string | null }) => {
      if (!member.user_id) return true;
      const user = await getUserEmail(member.user_id);
      return user ? sendEmail(user.email, subject, htmlFor(escapeHtml(user.name))) : true;
    }),
  );
  return results.every((result) => result.status === 'fulfilled' && result.value !== false);
}

async function handleJobAssigned(event: NotificationEvent) {
  const userId = typeof event.payload.driver_user_id === 'string' ? event.payload.driver_user_id : null;
  if (!userId) return true;
  const user = await getUserEmail(userId);
  const jobIdRaw = String(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'TBC');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'TBC');
  const appPath = `/driver/jobs/${encodeURIComponent(jobIdRaw)}`;
  const [emailOk, pushOk] = await Promise.all([
    user
      ? sendEmail(
          user.email,
          'New Job Assigned - XDrive Logistics',
          `<h2>You have a new job assigned</h2><p>Hi ${escapeHtml(user.name)},</p><p>A new job has been assigned to you.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p><a href="${escapeHtml(buildAppUrl(appPath))}">View job details</a></p><p>XDrive Logistics</p>`,
        )
      : Promise.resolve(true),
    sendPushToUser(userId, {
      title: 'New job assigned',
      body: `${pickup} → ${delivery}`,
      data: { path: appPath, jobId: jobIdRaw, eventType: event.event_type },
    }),
  ]);
  return emailOk && pushOk;
}

async function handleBidAccepted(event: NotificationEvent) {
  const userId = typeof event.payload.bidder_user_id === 'string' ? event.payload.bidder_user_id : null;
  if (!userId) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  const amount = escapeHtml(event.payload.bid_price_gbp ?? event.payload.amount ?? event.payload.bid_amount ?? 'N/A');
  const jobId = escapeHtml(event.payload.job_id ?? event.entity_id);
  return sendEmail(
    user.email,
    'Bid Accepted - XDrive Logistics',
    `<h2>Your bid has been accepted</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your bid of <strong>£${amount}</strong> on job <strong>${jobId}</strong> has been accepted.</p><p><a href="${escapeHtml(buildAppUrl('/admin/bids'))}">Open the bids workspace</a></p><p>XDrive Logistics</p>`,
  );
}

async function handlePodUploaded(event: NotificationEvent) {
  const companyId = typeof event.payload.company_id === 'string'
    ? event.payload.company_id
    : event.company_id;
  if (!companyId) return true;
  const jobId = escapeHtml(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'N/A');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'N/A');
  return emailCompanyOperators(
    companyId,
    'Job Delivered - POD Ready',
    (name) => `<h2>Job delivered - POD available</h2><p>Hi ${name},</p><p>Job <strong>${jobId}</strong> has been marked delivered.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p>Sign in to review the proof of delivery.</p><p>XDrive Logistics</p>`,
  );
}

async function handleOnboardingInvite(event: NotificationEvent) {
  const userId = typeof event.payload.recipient_user_id === 'string'
    ? event.payload.recipient_user_id
    : event.recipient_user_id;
  if (!userId) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  const onboardingUrl = safeOnboardingUrl(event.payload.onboarding_url);
  const accountType = escapeHtml(String(event.payload.account_type ?? 'account').replaceAll('_', ' '));
  return sendEmail(
    user.email,
    'Complete onboarding - XDrive Logistics',
    `<h2>Your XDrive onboarding is ready</h2><p>Hi ${escapeHtml(user.name)},</p><p>Continue onboarding to unlock your workspace.</p><p><strong>Account type:</strong> ${accountType}</p><p><a href="${escapeHtml(onboardingUrl)}">Start or resume onboarding</a></p><p>XDrive Logistics</p>`,
  );
}

async function handleOnboardingSubmitted(event: NotificationEvent) {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  const accountType = escapeHtml(String(event.payload.account_type ?? 'account').replaceAll('_', ' '));
  const reference = escapeHtml(event.payload.onboarding_application_id ?? event.entity_id);
  return sendEmail(
    user.email,
    'Onboarding submitted - XDrive Logistics',
    `<h2>Onboarding submitted</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your ${accountType} onboarding has been submitted for review.</p><p>Reference: <strong>${reference}</strong></p><p>XDrive Logistics</p>`,
  );
}

async function handleOnboardingApproved(event: NotificationEvent) {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return true;
  const user = await getUserEmail(userId);
  const [emailOk, pushOk] = await Promise.all([
    user
      ? sendEmail(
          user.email,
          'Onboarding approved - XDrive Logistics',
          `<h2>Your XDrive workspace is approved</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your onboarding has been approved. You can now sign in and use your workspace.</p><p><a href="${escapeHtml(buildAppUrl('/login'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
        )
      : Promise.resolve(true),
    sendPushToUser(userId, {
      title: 'Onboarding approved',
      body: 'Your XDrive workspace is ready to use.',
      data: { path: '/login', eventType: event.event_type },
    }),
  ]);
  return emailOk && pushOk;
}

async function handleInvoiceDisputed(event: NotificationEvent) {
  const invoiceId = escapeHtml(event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return true;
    return sendEmail(
      user.email,
      'Invoice disputed - XDrive Logistics',
      `<h2>Invoice disputed</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
    );
  }
  if (!companyId) return true;
  return emailCompanyOperators(
    companyId,
    'Invoice disputed - XDrive Logistics',
    (name) => `<h2>Invoice disputed</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
  );
}

async function handleInvoiceCreated(event: NotificationEvent) {
  const invoiceNumber = escapeHtml(event.payload.invoice_number ?? event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    const [emailOk, pushOk] = await Promise.all([
      user
        ? sendEmail(
            user.email,
            'Invoice created - XDrive Logistics',
            `<h2>Invoice created</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
          )
        : Promise.resolve(true),
      sendPushToUser(event.recipient_user_id, {
        title: 'Invoice created',
        body: `Invoice ${invoiceNumber} is ready for review.`,
        data: { path: '/driver/finance', invoiceNumber, eventType: event.event_type },
      }),
    ]);
    return emailOk && pushOk;
  }
  if (!companyId) return true;
  return emailCompanyOperators(
    companyId,
    'Invoice created - XDrive Logistics',
    (name) => `<h2>Invoice created</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
  );
}

async function processEvent(event: NotificationEvent): Promise<void> {
  let success = false;
  let skipped = false;
  try {
    switch (event.event_type) {
      case 'job_assigned': success = await handleJobAssigned(event); break;
      case 'bid_accepted': success = await handleBidAccepted(event); break;
      case 'pod_uploaded': success = await handlePodUploaded(event); break;
      case 'onboarding_invite':
      case 'onboarding_invite_resent':
        success = await handleOnboardingInvite(event);
        break;
      case 'onboarding_submitted': success = await handleOnboardingSubmitted(event); break;
      case 'onboarding_approved': success = await handleOnboardingApproved(event); break;
      case 'invoice_disputed': success = await handleInvoiceDisputed(event); break;
      case 'invoice_created': success = await handleInvoiceCreated(event); break;
      default:
        console.log(`[notify] Unknown event type: ${event.event_type} - skipped`);
        skipped = true;
    }
  } catch (error) {
    console.error(`[notify] Event ${event.id} failed`, error);
  }

  const attemptCount = Math.max(0, Number(event.attempt_count ?? 0)) + 1;
  const status = skipped ? 'skipped' : success ? 'sent' : 'failed';
  const retryDelayMinutes = Math.min(60, 2 ** Math.min(attemptCount, 6));
  const nextAttemptAt = success || skipped
    ? null
    : new Date(Date.now() + retryDelayMinutes * 60_000).toISOString();

  const { error } = await supabase
    .from('notification_events')
    .update({
      status,
      processed_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      attempt_count: attemptCount,
      next_attempt_at: nextAttemptAt,
      last_error: success || skipped ? null : 'Notification provider or event handler failed.',
    })
    .eq('id', event.id)
    .in('status', ['pending', 'failed']);

  if (error) console.error(`[notify] Could not update event ${event.id}: ${error.message}`);
}

const isDueForRetry = (event: NotificationEvent, nowMs: number) => {
  if (!event.next_attempt_at) return true;
  const retryAt = Date.parse(event.next_attempt_at);
  return Number.isFinite(retryAt) && retryAt <= nowMs;
};

async function loadWebhookEvent(eventId: string): Promise<NotificationEvent[]> {
  const { data, error } = await supabase
    .from('notification_events')
    .select('*')
    .eq('id', eventId)
    .in('status', ['pending', 'failed'])
    .maybeSingle();
  if (error) throw error;
  return data ? [data as NotificationEvent] : [];
}

async function loadDueEvents(): Promise<NotificationEvent[]> {
  const { data, error } = await supabase
    .from('notification_events')
    .select('*')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  const nowMs = Date.now();
  return ((data ?? []) as NotificationEvent[])
    .filter((event) => isDueForRetry(event, nowMs))
    .slice(0, 50);
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' });
    }
    if (!supabaseUrl || !serviceRoleKey || !webhookSecret || webhookSecret.length < 32) {
      return jsonResponse(503, { error: 'Notification function configuration is incomplete.' });
    }

    const suppliedSecret = request.headers.get('x-xdrive-webhook-secret') ?? '';
    if (!constantTimeEqual(suppliedSecret, webhookSecret)) {
      return jsonResponse(401, { error: 'Unauthorized.' });
    }

    const body = await request.json().catch(() => null);
    const webhookEventId = body?.record?.id ?? body?.id ?? null;
    const events = isUuid(webhookEventId)
      ? await loadWebhookEvent(webhookEventId)
      : await loadDueEvents();

    await Promise.allSettled(events.map(processEvent));
    return jsonResponse(200, { processed: events.length });
  } catch (error) {
    console.error('[notify] Fatal error', error);
    return jsonResponse(500, { error: 'Internal server error.' });
  }
});
