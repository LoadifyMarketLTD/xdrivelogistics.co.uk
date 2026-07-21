/**
 * Processes the notification_events queue.
 *
 * Deploy with --no-verify-jwt only when every caller supplies the private
 * XDRIVE_NOTIFICATION_WEBHOOK_SECRET in the x-xdrive-webhook-secret header.
 * Events are claimed atomically in Postgres and completed through service-role
 * RPCs so concurrent webhooks cannot send the same event twice.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://www.xdrivelogistics.co.uk').trim().replace(/\/$/, '');
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const resendApiUrl = (Deno.env.get('RESEND_API_URL') ?? 'https://api.resend.com/emails').trim();
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
  attempt_count: number;
}

interface DeliveryResult {
  success: boolean;
  providerMessageIds: string[];
  error?: string;
}

const ok = (...providerMessageIds: string[]): DeliveryResult => ({
  success: true,
  providerMessageIds: providerMessageIds.filter(Boolean),
});

const failed = (error: string): DeliveryResult => ({
  success: false,
  providerMessageIds: [],
  error,
});

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

const secureEqual = (left: string, right: string) => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
};

const normalizeError = (value: unknown) => {
  const message = value instanceof Error ? value.message : String(value ?? 'Unknown notification error.');
  return message.slice(0, 1800);
};

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
  event: NotificationEvent,
  recipientKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<DeliveryResult> {
  if (!resendApiKey) {
    return failed(`RESEND_API_KEY is not configured; email not sent: ${subject}`);
  }

  const idempotencyKey = `xdrive/${event.event_type}/${event.id}/${recipientKey}`.slice(0, 256);
  try {
    const response = await fetch(resendApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });

    const responseText = await response.text().catch(() => '');
    if (!response.ok) {
      return failed(`Resend rejected email: ${response.status} ${responseText}`.slice(0, 1800));
    }

    let providerMessageId = '';
    try {
      const payload = responseText ? JSON.parse(responseText) as { id?: unknown } : null;
      providerMessageId = typeof payload?.id === 'string' ? payload.id : '';
    } catch {
      providerMessageId = '';
    }
    return ok(providerMessageId);
  } catch (error) {
    return failed(`Resend request failed: ${normalizeError(error)}`);
  }
}

async function emailCompanyOperators(
  event: NotificationEvent,
  companyId: string,
  subject: string,
  htmlFor: (safeName: string) => string,
): Promise<DeliveryResult> {
  const { data: members, error } = await supabase
    .from('company_memberships')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .eq('status', 'active');

  if (error) return failed(`Failed to resolve company notification recipients: ${error.message}`);
  if (!members?.length) return ok();

  const results = await Promise.all(
    members.map(async (member: { user_id: string }) => {
      const user = await getUserEmail(member.user_id);
      return user
        ? sendEmail(event, member.user_id, user.email, subject, htmlFor(escapeHtml(user.name)))
        : ok();
    }),
  );

  const errors = results.filter((result) => !result.success).map((result) => result.error).filter(Boolean);
  const providerMessageIds = results.flatMap((result) => result.providerMessageIds);
  return errors.length > 0
    ? { success: false, providerMessageIds, error: errors.join(' | ').slice(0, 1800) }
    : ok(...providerMessageIds);
}

async function handleJobAssigned(event: NotificationEvent): Promise<DeliveryResult> {
  const userId = typeof event.payload.driver_user_id === 'string' ? event.payload.driver_user_id : null;
  if (!userId) return ok();
  const user = await getUserEmail(userId);
  if (!user) return ok();
  const jobIdRaw = String(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'TBC');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'TBC');
  return sendEmail(
    event,
    userId,
    user.email,
    'New Job Assigned - XDrive Logistics',
    `<h2>You have a new job assigned</h2><p>Hi ${escapeHtml(user.name)},</p><p>A new job has been assigned to you.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p><a href="${escapeHtml(buildAppUrl(`/driver/jobs/${encodeURIComponent(jobIdRaw)}`))}">View job details</a></p><p>XDrive Logistics</p>`,
  );
}

async function handleBidAccepted(event: NotificationEvent): Promise<DeliveryResult> {
  const userId = typeof event.payload.bidder_user_id === 'string' ? event.payload.bidder_user_id : null;
  if (!userId) return ok();
  const user = await getUserEmail(userId);
  if (!user) return ok();
  const amount = escapeHtml(event.payload.bid_price_gbp ?? event.payload.amount ?? event.payload.bid_amount ?? 'N/A');
  const jobId = escapeHtml(event.payload.job_id ?? event.entity_id);
  return sendEmail(
    event,
    userId,
    user.email,
    'Bid Accepted - XDrive Logistics',
    `<h2>Your bid has been accepted</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your bid of <strong>£${amount}</strong> on job <strong>${jobId}</strong> has been accepted.</p><p><a href="${escapeHtml(buildAppUrl('/admin/bids'))}">Open the bids workspace</a></p><p>XDrive Logistics</p>`,
  );
}

async function handlePodUploaded(event: NotificationEvent): Promise<DeliveryResult> {
  const companyId = typeof event.payload.company_id === 'string' ? event.payload.company_id : event.company_id;
  if (!companyId) return ok();
  const jobId = escapeHtml(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'N/A');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'N/A');
  return emailCompanyOperators(
    event,
    companyId,
    'Job Delivered - POD Ready',
    (name) => `<h2>Job delivered - POD available</h2><p>Hi ${name},</p><p>Job <strong>${jobId}</strong> has been marked delivered.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p>Sign in to review the proof of delivery.</p><p>XDrive Logistics</p>`,
  );
}

async function handleOnboardingInvite(event: NotificationEvent): Promise<DeliveryResult> {
  const userId = typeof event.payload.recipient_user_id === 'string'
    ? event.payload.recipient_user_id
    : event.recipient_user_id;
  if (!userId) return ok();
  const user = await getUserEmail(userId);
  if (!user) return ok();
  const onboardingUrl = safeOnboardingUrl(event.payload.onboarding_url);
  const accountType = escapeHtml(String(event.payload.account_type ?? 'account').replaceAll('_', ' '));
  return sendEmail(
    event,
    userId,
    user.email,
    'Complete onboarding - XDrive Logistics',
    `<h2>Your XDrive onboarding is ready</h2><p>Hi ${escapeHtml(user.name)},</p><p>Continue onboarding to unlock your workspace.</p><p><strong>Account type:</strong> ${accountType}</p><p><a href="${escapeHtml(onboardingUrl)}">Start or resume onboarding</a></p><p>XDrive Logistics</p>`,
  );
}

async function handleOnboardingSubmitted(event: NotificationEvent): Promise<DeliveryResult> {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return ok();
  const user = await getUserEmail(userId);
  if (!user) return ok();
  const accountType = escapeHtml(String(event.payload.account_type ?? 'account').replaceAll('_', ' '));
  const reference = escapeHtml(event.payload.onboarding_application_id ?? event.entity_id);
  return sendEmail(
    event,
    userId,
    user.email,
    'Onboarding submitted - XDrive Logistics',
    `<h2>Onboarding submitted</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your ${accountType} onboarding has been submitted for review.</p><p>Reference: <strong>${reference}</strong></p><p>XDrive Logistics</p>`,
  );
}

async function handleOnboardingApproved(event: NotificationEvent): Promise<DeliveryResult> {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return ok();
  const user = await getUserEmail(userId);
  if (!user) return ok();
  return sendEmail(
    event,
    userId,
    user.email,
    'Onboarding approved - XDrive Logistics',
    `<h2>Your XDrive workspace is approved</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your onboarding has been approved. You can now sign in and use your workspace.</p><p><a href="${escapeHtml(buildAppUrl('/login'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
  );
}

async function handleInvoiceDisputed(event: NotificationEvent): Promise<DeliveryResult> {
  const invoiceId = escapeHtml(event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return ok();
    return sendEmail(
      event,
      event.recipient_user_id,
      user.email,
      'Invoice disputed - XDrive Logistics',
      `<h2>Invoice disputed</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
    );
  }
  if (!companyId) return ok();
  return emailCompanyOperators(
    event,
    companyId,
    'Invoice disputed - XDrive Logistics',
    (name) => `<h2>Invoice disputed</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
  );
}

async function handleInvoiceCreated(event: NotificationEvent): Promise<DeliveryResult> {
  const invoiceNumber = escapeHtml(event.payload.invoice_number ?? event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return ok();
    return sendEmail(
      event,
      event.recipient_user_id,
      user.email,
      'Invoice created - XDrive Logistics',
      `<h2>Invoice created</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
    );
  }
  if (!companyId) return ok();
  return emailCompanyOperators(
    event,
    companyId,
    'Invoice created - XDrive Logistics',
    (name) => `<h2>Invoice created</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
  );
}

async function deliverEvent(event: NotificationEvent): Promise<DeliveryResult> {
  switch (event.event_type) {
    case 'job_assigned': return handleJobAssigned(event);
    case 'bid_accepted': return handleBidAccepted(event);
    case 'pod_uploaded': return handlePodUploaded(event);
    case 'onboarding_invite': return handleOnboardingInvite(event);
    case 'onboarding_submitted': return handleOnboardingSubmitted(event);
    case 'onboarding_approved': return handleOnboardingApproved(event);
    case 'invoice_disputed': return handleInvoiceDisputed(event);
    case 'invoice_created': return handleInvoiceCreated(event);
    default:
      console.log(`[notify] Unknown event type: ${event.event_type} - marked sent without external delivery`);
      return ok();
  }
}

async function processEvent(event: NotificationEvent): Promise<{ id: string; success: boolean; error?: string }> {
  let result: DeliveryResult;
  try {
    result = await deliverEvent(event);
  } catch (error) {
    result = failed(normalizeError(error));
  }

  const { error: completionError } = await supabase.rpc('complete_notification_event', {
    p_event_id: event.id,
    p_success: result.success,
    p_provider_message_id: result.providerMessageIds.join(','),
    p_error: result.error ?? null,
  });

  if (completionError) {
    const message = `Failed to complete notification event ${event.id}: ${completionError.message}`;
    console.error(`[notify] ${message}`);
    return { id: event.id, success: false, error: message };
  }

  if (!result.success) console.error(`[notify] Event ${event.id} failed: ${result.error}`);
  return { id: event.id, success: result.success, error: result.error };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' },
      });
    }

    if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: 'Notification function configuration is incomplete.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const suppliedSecret = request.headers.get('x-xdrive-webhook-secret') ?? '';
    if (!secureEqual(suppliedSecret, webhookSecret)) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => null) as {
      event_id?: unknown;
      record?: { id?: unknown };
    } | null;
    const requestedEventId = typeof body?.event_id === 'string'
      ? body.event_id
      : typeof body?.record?.id === 'string'
      ? body.record.id
      : null;

    const { data, error } = await supabase.rpc('claim_notification_events', {
      p_limit: requestedEventId ? 1 : 50,
      p_event_id: requestedEventId,
    });
    if (error) throw new Error(`Notification claim failed: ${error.message}`);

    const events = (data ?? []) as NotificationEvent[];
    const results = await Promise.all(events.map(processEvent));
    const succeeded = results.filter((result) => result.success).length;

    return new Response(JSON.stringify({
      claimed: events.length,
      processed: results.length,
      succeeded,
      failed: results.length - succeeded,
      eventIds: results.map((result) => result.id),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[notify] Fatal error', error);
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
