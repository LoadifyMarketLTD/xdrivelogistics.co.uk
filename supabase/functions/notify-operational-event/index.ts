/**
 * Processes the notification_events queue.
 *
 * This function may be deployed with --no-verify-jwt only when every caller
 * supplies the private XDRIVE_NOTIFICATION_WEBHOOK_SECRET in the
 * x-xdrive-webhook-secret header. Configure the same header on the Supabase
 * Database Webhook or pg_cron request.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://www.xdrivelogistics.co.uk').trim().replace(/\/$/, '');
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@xdrivelogistics.co.uk';
const webhookSecret = Deno.env.get('XDRIVE_NOTIFICATION_WEBHOOK_SECRET') ?? '';

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface NotificationEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  company_id: string | null;
  recipient_user_id: string | null;
  payload: Record<string, unknown>;
  status: string;
}

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
    console.error(`[notify] Resend rejected email: ${response.status} ${responseText}`);
    return false;
  }
  return true;
}

async function emailCompanyOperators(
  companyId: string,
  subject: string,
  htmlFor: (safeName: string) => string,
): Promise<boolean> {
  const { data: members } = await supabase
    .from('company_memberships')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .eq('status', 'active');

  if (!members?.length) return true;
  const results = await Promise.allSettled(
    members.map(async (member: { user_id: string }) => {
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
  if (!user) return true;
  const jobId = escapeHtml(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'TBC');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'TBC');
  return sendEmail(
    user.email,
    'New Job Assigned - XDrive Logistics',
    `<h2>You have a new job assigned</h2><p>Hi ${escapeHtml(user.name)},</p><p>A new job has been assigned to you.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p><a href="${escapeHtml(buildAppUrl(`/driver/jobs/${jobId}`))}">View job details</a></p><p>XDrive Logistics</p>`,
  );
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
  if (!user) return true;
  return sendEmail(
    user.email,
    'Onboarding approved - XDrive Logistics',
    `<h2>Your XDrive workspace is approved</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your onboarding has been approved. You can now sign in and use your workspace.</p><p><a href="${escapeHtml(buildAppUrl('/login'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
  );
}

async function handleInvoiceDisputed(event: NotificationEvent) {
  const invoiceId = escapeHtml(event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return true;
    return sendEmail(user.email, 'Invoice disputed - XDrive Logistics', `<h2>Invoice disputed</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`);
  }
  if (!companyId) return true;
  return emailCompanyOperators(companyId, 'Invoice disputed - XDrive Logistics', (name) => `<h2>Invoice disputed</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceId}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`);
}

async function handleInvoiceCreated(event: NotificationEvent) {
  const invoiceNumber = escapeHtml(event.payload.invoice_number ?? event.payload.invoice_id ?? event.entity_id);
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return true;
    return sendEmail(user.email, 'Invoice created - XDrive Logistics', `<h2>Invoice created</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`);
  }
  if (!companyId) return true;
  return emailCompanyOperators(companyId, 'Invoice created - XDrive Logistics', (name) => `<h2>Invoice created</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceNumber}</strong> has been created.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`);
}

async function processEvent(event: NotificationEvent): Promise<void> {
  let success = false;
  try {
    switch (event.event_type) {
      case 'job_assigned': success = await handleJobAssigned(event); break;
      case 'bid_accepted': success = await handleBidAccepted(event); break;
      case 'pod_uploaded': success = await handlePodUploaded(event); break;
      case 'onboarding_invite': success = await handleOnboardingInvite(event); break;
      case 'onboarding_submitted': success = await handleOnboardingSubmitted(event); break;
      case 'onboarding_approved': success = await handleOnboardingApproved(event); break;
      case 'invoice_disputed': success = await handleInvoiceDisputed(event); break;
      case 'invoice_created': success = await handleInvoiceCreated(event); break;
      default:
        console.log(`[notify] Unknown event type: ${event.event_type} - skipped`);
        success = true;
    }
  } catch (error) {
    console.error(`[notify] Event ${event.id} failed`, error);
  }

  await supabase
    .from('notification_events')
    .update({
      status: success ? 'sent' : 'failed',
      processed_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      attempt_count: (event as NotificationEvent & { attempt_count?: number }).attempt_count
        ? (event as NotificationEvent & { attempt_count?: number }).attempt_count! + 1
        : 1,
      last_error: success ? null : 'Notification provider or event handler failed.',
    })
    .eq('id', event.id);
}

Deno.serve(async (request) => {
  try {
    if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: 'Notification function configuration is incomplete.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const suppliedSecret = request.headers.get('x-xdrive-webhook-secret') ?? '';
    if (suppliedSecret.length !== webhookSecret.length || suppliedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => null);
    let events: NotificationEvent[] = [];
    if (body?.record) {
      events = [body.record as NotificationEvent];
    } else {
      const { data } = await supabase
        .from('notification_events')
        .select('*')
        .in('status', ['pending', 'failed'])
        .or('next_attempt_at.is.null,next_attempt_at.lte.now()')
        .order('created_at', { ascending: true })
        .limit(50);
      events = (data ?? []) as NotificationEvent[];
    }

    await Promise.allSettled(events.map(processEvent));
    return new Response(JSON.stringify({ processed: events.length }), {
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
