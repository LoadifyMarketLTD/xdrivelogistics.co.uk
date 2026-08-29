/**
 * Processes the notification_events queue.
 *
 * Private callers may authenticate in either of two ways:
 * - the exact SUPABASE_SERVICE_ROLE_KEY as a Bearer token (the canonical DB
 *   trigger already uses this legacy path),
 * - any configured modern Supabase secret key in the apikey header, or
 * - XDRIVE_NOTIFICATION_WEBHOOK_SECRET in x-xdrive-webhook-secret for an
 *   explicitly configured Database Webhook / scheduler.
 *
 * When deployed with --no-verify-jwt this function still fails closed unless
 * one of those private credentials matches in constant time.
 *
 * Queue rows are claimed through the DB lease RPC before any provider call.
 * The lease prevents concurrent workers and the stable Resend Idempotency-Key
 * prevents a retry from duplicating email delivery. FCM shares this canonical
 * event queue and is enabled only when a valid Firebase service account exists.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseFirebaseServiceAccount, sendFcmMessage } from './fcm.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const secretApiKeys = (() => {
  try {
    const configured = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, unknown>;
    return Object.values(configured).filter(
      (value): value is string => typeof value === 'string' && value.startsWith('sb_secret_'),
    );
  } catch {
    return [];
  }
})();
const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://www.xdrivelogistics.co.uk').trim().replace(/\/$/, '');
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@xdrivelogistics.co.uk';
const webhookSecret = Deno.env.get('XDRIVE_NOTIFICATION_WEBHOOK_SECRET') ?? '';
const firebaseServiceAccount = parseFirebaseServiceAccount(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') ?? '');

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
  lease_token?: string | null;
  lease_expires_at?: string | null;
}

interface PushDevice {
  device_id: string;
  installation_id: string;
  fcm_token: string;
  platform: string;
  app_package: string;
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

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
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

const notificationIdempotencyKey = (eventId: string, recipientId: string) =>
  `xdrive-notification/${eventId}/${recipientId}`.slice(0, 256);

async function getUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  const metadata = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return {
    email: data.user.email,
    name: metadata.full_name ?? metadata.name ?? data.user.email.split('@')[0],
  };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
): Promise<boolean> {
  if (!resendApiKey) {
    console.error(`[notify] RESEND_API_KEY is not configured; email not sent: ${subject}`);
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
      'Idempotency-Key': idempotencyKey,
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

async function sendDriverPush(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  // Push is additive. Existing email/inbox delivery must keep working before a
  // Firebase project is configured, so missing Firebase credentials are neutral.
  if (!firebaseServiceAccount) return true;

  const { data: deviceData, error } = await supabase.rpc('active_driver_push_devices_for_user', {
    p_user_id: userId,
  });
  if (error) {
    console.error(`[notify] Could not load active push devices for ${userId}: ${error.message}`);
    return false;
  }

  const devices = (deviceData ?? []) as PushDevice[];
  if (!devices.length) return true;

  const results = await Promise.all(devices.map(async (device) => {
    const result = await sendFcmMessage({
      account: firebaseServiceAccount,
      token: device.fcm_token,
      title,
      body,
      data,
    });

    if (result.unregistered) {
      const { error: disableError } = await supabase
        .from('driver_push_devices')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('id', device.device_id);
      if (disableError) {
        console.error(`[notify] Could not disable unregistered push device ${device.device_id}: ${disableError.message}`);
        return false;
      }
      return true;
    }

    if (!result.ok) {
      console.error(`[notify] FCM delivery failed for device ${device.device_id}: ${result.error ?? 'unknown error'}`);
    }
    return result.ok;
  }));

  return results.every(Boolean);
}

async function emailCompanyOperators(
  companyId: string,
  subject: string,
  htmlFor: (safeName: string) => string,
  eventId: string,
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
      return user
        ? sendEmail(
          user.email,
          subject,
          htmlFor(escapeHtml(user.name)),
          notificationIdempotencyKey(eventId, member.user_id),
        )
        : true;
    }),
  );
  return results.every((result) => result.status === 'fulfilled' && result.value !== false);
}

async function handleJobAssigned(event: NotificationEvent) {
  const userId = typeof event.payload.driver_user_id === 'string' ? event.payload.driver_user_id : null;
  if (!userId) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  const jobIdRaw = String(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'TBC');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'TBC');
  const [emailOk, pushOk] = await Promise.all([
    sendEmail(
      user.email,
      'New Job Assigned - XDrive Logistics',
      `<h2>You have a new job assigned</h2><p>Hi ${escapeHtml(user.name)},</p><p>A new job has been assigned to you.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p><a href="${escapeHtml(buildAppUrl(`/driver/jobs/${encodeURIComponent(jobIdRaw)}`))}">View job details</a></p><p>XDrive Logistics</p>`,
      notificationIdempotencyKey(event.id, userId),
    ),
    sendDriverPush(
      userId,
      'New Job Assigned - XDrive Logistics',
      'A new job has been assigned to you. Open XDrive to view the job details.',
      {
        event_type: 'job_assigned',
        job_id: jobIdRaw,
        deep_link: `xdrive://job/${jobIdRaw}`,
      },
    ),
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
    notificationIdempotencyKey(event.id, userId),
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
    event.id,
  );
}

async function handleLoadAlert(event: NotificationEvent) {
  const userId = event.recipient_user_id;
  if (!userId) return true;

  const emailEnabled = event.payload.email_enabled === true;
  const pushEnabled = event.payload.push_enabled === true;
  if (!emailEnabled && !pushEnabled) return true;

  const jobId = String(event.payload.job_id ?? event.entity_id);
  const pickup = String(event.payload.pickup_outcode ?? 'Collection area TBC');
  const delivery = String(event.payload.delivery_outcode ?? 'Delivery area TBC');
  const vehicle = String(event.payload.vehicle_type ?? '').trim();
  const budgetValue = event.payload.budget_amount;
  const budget = typeof budgetValue === 'number'
    ? budgetValue
    : typeof budgetValue === 'string' && budgetValue.trim() ? Number(budgetValue) : null;
  const routeSummary = `${pickup} → ${delivery}`;
  const budgetSummary = typeof budget === 'number' && Number.isFinite(budget) && budget >= 0
    ? ` · £${budget.toFixed(2)}`
    : '';
  const vehicleSummary = vehicle ? ` · ${vehicle}` : '';
  const publicSummary = `${routeSummary}${vehicleSummary}${budgetSummary}`;

  let emailOk = true;
  if (emailEnabled) {
    const user = await getUserEmail(userId);
    if (user) {
      emailOk = await sendEmail(
        user.email,
        'New load matches your alert - XDrive Logistics',
        `<h2>A new load matches your alert</h2><p>Hi ${escapeHtml(user.name)},</p><p><strong>${escapeHtml(routeSummary)}</strong></p>${vehicle ? `<p>Vehicle: <strong>${escapeHtml(vehicle)}</strong></p>` : ''}${budgetSummary ? `<p>Budget: <strong>£${escapeHtml(Number(budget).toFixed(2))}</strong></p>` : ''}<p>Exact addresses remain hidden before award. Open XDrive to review the public marketplace details and quote if suitable.</p><p><a href="${escapeHtml(buildAppUrl('/driver/loads'))}">Open Load Exchange</a></p><p>XDrive Logistics</p>`,
        notificationIdempotencyKey(event.id, userId),
      );
    }
  }

  const pushOk = pushEnabled
    ? await sendDriverPush(
      userId,
      'New load matches your alert',
      publicSummary,
      {
        event_type: 'load_alert',
        job_id: jobId,
        deep_link: `xdrive://loads/${jobId}`,
      },
    )
    : true;

  return emailOk && pushOk;
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
    notificationIdempotencyKey(event.id, userId),
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
    notificationIdempotencyKey(event.id, userId),
  );
}

async function handleOnboardingApproved(event: NotificationEvent) {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  return sendEmail(
    user.email,
    'Onboarding approved - XDrive Logistics',
    `<h2>Your XDrive workspace is approved</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your onboarding has been approved. You can now sign in and use your workspace.</p><p><a href="${escapeHtml(buildAppUrl('/login'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
  );
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
      notificationIdempotencyKey(event.id, event.recipient_user_id),
    );
  }
  if (!companyId) return true;
  return emailCompanyOperators(
    companyId,
    'Invoice disputed - XDrive Logistics',
    (name) => `<h2>Invoice disputed</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
    event.id,
  );
}

async function handleInvoiceCreated(event: NotificationEvent) {
  const invoiceNumber = escapeHtml(event.payload.invoice_number ?? event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return true;
    return sendEmail(
      user.email,
      'Invoice created - XDrive Logistics',
      `<h2>Invoice created</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
      notificationIdempotencyKey(event.id, event.recipient_user_id),
    );
  }
  if (!companyId) return true;
  return emailCompanyOperators(
    companyId,
    'Invoice created - XDrive Logistics',
    (name) => `<h2>Invoice created</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
    event.id,
  );
}

async function processEvent(event: NotificationEvent): Promise<void> {
  const leaseToken = event.lease_token ?? '';
  if (!leaseToken) {
    console.error(`[notify] Event ${event.id} arrived without a queue lease; skipped.`);
    return;
  }

  let success = false;
  let skipped = false;
  try {
    switch (event.event_type) {
      case 'job_assigned': success = await handleJobAssigned(event); break;
      case 'bid_accepted': success = await handleBidAccepted(event); break;
      case 'pod_uploaded': success = await handlePodUploaded(event); break;
      case 'load_alert': success = await handleLoadAlert(event); break;
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
      lease_token: null,
      lease_expires_at: null,
    })
    .eq('id', event.id)
    .eq('lease_token', leaseToken);

  if (error) console.error(`[notify] Could not finalize event ${event.id}: ${error.message}`);
}

async function claimEvents(eventId: string | null, limit: number): Promise<NotificationEvent[]> {
  const { data, error } = await supabase.rpc('claim_notification_events', {
    p_event_id: eventId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as NotificationEvent[];
}

async function loadWebhookEvent(eventId: string): Promise<NotificationEvent[]> {
  return claimEvents(eventId, 1);
}

async function loadDueEvents(): Promise<NotificationEvent[]> {
  return claimEvents(null, 50);
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(503, { error: 'Notification function configuration is incomplete.' });
    }

    const suppliedSecret = request.headers.get('x-xdrive-webhook-secret') ?? '';
    const suppliedApiKey = request.headers.get('apikey') ?? '';
    const serviceBearer = bearerToken(request);
    const webhookAuthorized = webhookSecret.length >= 32 && constantTimeEqual(suppliedSecret, webhookSecret);
    const serviceRoleAuthorized = constantTimeEqual(serviceBearer, serviceRoleKey);
    const secretApiKeyAuthorized = secretApiKeys.some((key) => constantTimeEqual(suppliedApiKey, key));

    if (!webhookAuthorized && !serviceRoleAuthorized && !secretApiKeyAuthorized) {
      return jsonResponse(401, { error: 'Unauthorized.' });
    }

    const body = await request.json().catch(() => null);
    const webhookEventId = body?.record?.id ?? body?.id ?? body?.event_id ?? null;
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
