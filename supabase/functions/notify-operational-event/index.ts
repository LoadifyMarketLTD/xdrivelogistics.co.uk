/**
 * notify-operational-event
 *
 * Supabase Edge Function that processes the notification_events queue.
 * Called via:
 *   - Supabase Database Webhook (recommended: set up in Supabase Dashboard
 *     under Database → Webhooks → on INSERT to notification_events)
 *   - Or periodic pg_cron invocation: SELECT net.http_post(...)
 *
 * Handles:
 *   - job_assigned:  Email driver when a job is assigned
 *   - bid_accepted:  Email carrier when their bid wins
 *   - pod_uploaded:  Email company admin when driver marks delivered
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   SUPABASE_URL             (auto-injected)
 *   SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 *   RESEND_API_KEY           (optional: if using Resend for transactional email)
 *   FROM_EMAIL               (optional: sender address, defaults to no-reply@xdrivelogistics.co.uk)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@xdrivelogistics.co.uk';

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

interface UserRecord {
  email: string | null;
  raw_user_meta_data: { full_name?: string; name?: string } | null;
}

async function getUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  const user = data.user as unknown as UserRecord;
  const email = user.email ?? data.user.email ?? null;
  if (!email) return null;
  const meta = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = meta.full_name ?? meta.name ?? email.split('@')[0];
  return { email, name };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resendApiKey) {
    console.log(`[notify] No RESEND_API_KEY — would send to ${to}: ${subject}`);
    return true; // Treat as success so events don't stay pending
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + resendApiKey,
    },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });
  return res.ok;
}

async function handleJobAssigned(event: NotificationEvent): Promise<boolean> {
  const { driver_user_id, pickup_location, delivery_location, job_id } = event.payload;
  if (!driver_user_id) return true; // no driver user — skip silently

  const user = await getUserEmail(driver_user_id as string);
  if (!user) return true; // driver has no email — skip

  const jobUrl = `${supabaseUrl.replace('supabase.co', 'xdrivelogistics.co.uk')}/driver/jobs/${job_id}`;
  const html = `
    <h2>You have a new job assigned</h2>
    <p>Hi ${user.name},</p>
    <p>A new job has been assigned to you:</p>
    <ul>
      <li><strong>Pickup:</strong> ${pickup_location ?? 'TBC'}</li>
      <li><strong>Delivery:</strong> ${delivery_location ?? 'TBC'}</li>
    </ul>
    <p><a href="${jobUrl}">View job details →</a></p>
    <p>XDrive Logistics</p>
  `;
  return sendEmail(user.email, '🚚 New Job Assigned — XDrive Logistics', html);
}

async function handleBidAccepted(event: NotificationEvent): Promise<boolean> {
  const { bidder_user_id, job_id, bid_amount } = event.payload;
  if (!bidder_user_id) return true;

  const user = await getUserEmail(bidder_user_id as string);
  if (!user) return true;

  const html = `
    <h2>Your bid has been accepted!</h2>
    <p>Hi ${user.name},</p>
    <p>Great news — your bid of <strong>£${bid_amount ?? 'N/A'}</strong> on job <strong>${job_id}</strong> has been accepted.</p>
    <p>Please log in to XDrive Logistics to proceed.</p>
    <p>XDrive Logistics</p>
  `;
  return sendEmail(user.email, '✅ Bid Accepted — XDrive Logistics', html);
}

async function handlePodUploaded(event: NotificationEvent): Promise<boolean> {
  const { job_id, company_id, pickup_location, delivery_location } = event.payload;
  if (!company_id) return true;

  // Notify all active company admins/owners
  const { data: members } = await supabase
    .from('company_memberships')
    .select('user_id, role_in_company')
    .eq('company_id', company_id)
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .eq('status', 'active');

  if (!members?.length) return true;

  const emailJobs = members.map(async (m: { user_id: string }) => {
    const user = await getUserEmail(m.user_id);
    if (!user) return;
    const html = `
      <h2>Job Delivered — POD Available</h2>
      <p>Hi ${user.name},</p>
      <p>Job <strong>${job_id}</strong> has been marked as delivered by the driver.</p>
      <ul>
        <li><strong>Pickup:</strong> ${pickup_location ?? 'N/A'}</li>
        <li><strong>Delivery:</strong> ${delivery_location ?? 'N/A'}</li>
      </ul>
      <p>Please log in to review the proof of delivery and process the invoice.</p>
      <p>XDrive Logistics</p>
    `;
    await sendEmail(user.email, '📦 Job Delivered — POD Ready', html);
  });

  await Promise.allSettled(emailJobs);
  return true;
}

async function processEvent(event: NotificationEvent): Promise<void> {
  let success = false;
  try {
    switch (event.event_type) {
      case 'job_assigned':
        success = await handleJobAssigned(event);
        break;
      case 'bid_accepted':
        success = await handleBidAccepted(event);
        break;
      case 'pod_uploaded':
        success = await handlePodUploaded(event);
        break;
      default:
        console.log(`[notify] Unknown event type: ${event.event_type} — skipping`);
        success = true;
    }
  } catch (err) {
    console.error(`[notify] Error processing event ${event.id}:`, err);
    success = false;
  }

  await supabase
    .from('notification_events')
    .update({
      status: success ? 'sent' : 'failed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', event.id);
}

Deno.serve(async (req) => {
  try {
    // Accept a single event from a DB webhook payload, or process pending queue
    const body = await req.json().catch(() => null);

    let events: NotificationEvent[] = [];

    if (body?.record) {
      // Called from a Supabase Database Webhook — process the single inserted event
      events = [body.record as NotificationEvent];
    } else {
      // Called manually or from a cron — process all pending events (batch 50)
      const { data } = await supabase
        .from('notification_events')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);
      events = (data ?? []) as NotificationEvent[];
    }

    await Promise.allSettled(events.map(processEvent));

    return new Response(
      JSON.stringify({ processed: events.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[notify] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
