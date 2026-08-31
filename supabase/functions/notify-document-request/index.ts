import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@xdrivelogistics.co.uk';
const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://www.xdrivelogistics.co.uk').replace(/\/$/, '');
const webhookSecret = Deno.env.get('XDRIVE_NOTIFICATION_WEBHOOK_SECRET') ?? '';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type NotificationEvent = {
  id: string;
  event_type: string;
  entity_id: string;
  recipient_user_id: string | null;
  payload: Record<string, unknown>;
  attempt_count?: number;
  lease_token?: string | null;
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const constantTimeEqual = (a: string, b: string) => {
  const enc = new TextEncoder();
  const aa = enc.encode(a); const bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
};

const bearer = (request: Request) => {
  const match = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const safeOnboardingUrl = (value: unknown) => {
  try {
    const candidate = new URL(typeof value === 'string' && value.trim() ? value : '/onboarding/resume', `${siteUrl}/`);
    const origin = new URL(siteUrl).origin;
    return candidate.origin === origin && candidate.pathname.startsWith('/onboarding/')
      ? candidate.toString()
      : `${siteUrl}/onboarding/resume`;
  } catch {
    return `${siteUrl}/onboarding/resume`;
  }
};

async function send(event: NotificationEvent) {
  if (!event.recipient_user_id || !resendApiKey) return false;
  const { data, error } = await supabase.auth.admin.getUserById(event.recipient_user_id);
  if (error || !data?.user?.email) return false;

  const metadata = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = metadata.full_name ?? metadata.name ?? data.user.email.split('@')[0];
  const docs = Array.isArray(event.payload.missing_documents)
    ? event.payload.missing_documents.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (!docs.length) return false;

  const list = docs.map((doc) => `<li style="margin:6px 0"><strong>${escapeHtml(doc.replaceAll('_', ' '))}</strong></li>`).join('');
  const reason = typeof event.payload.reason === 'string' && event.payload.reason.trim()
    ? `<p><strong>Message from XDrive:</strong> ${escapeHtml(event.payload.reason)}</p>` : '';
  const onboardingUrl = safeOnboardingUrl(event.payload.onboarding_url);
  const reminder = event.event_type === 'onboarding_documents_reminder';
  const subject = reminder
    ? 'Reminder: documents required to complete your XDrive onboarding'
    : 'Documents required to complete your XDrive onboarding';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
      'Idempotency-Key': `xdrive-document-request/${event.id}/${event.recipient_user_id}`.slice(0, 256),
    },
    body: JSON.stringify({
      from: fromEmail,
      to: data.user.email,
      subject,
      html: `<h2>${reminder ? 'Your onboarding is still incomplete' : 'Please complete your XDrive documents'}</h2>
<p>Hi ${escapeHtml(name)},</p>
<p>${reminder ? 'The following required documents are still outstanding:' : 'To continue your XDrive onboarding, please upload or correct the following required documents:'}</p>
<ul>${list}</ul>
${reason}
<p><a href="${escapeHtml(onboardingUrl)}" style="display:inline-block;padding:11px 18px;background:#1d57d8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Complete your documents</a></p>
<p>This request remains outstanding until the required documents are uploaded and approved.</p>
<p>XDrive Logistics</p>`,
    }),
  });
  return response.ok;
}

async function processEvent(event: NotificationEvent) {
  const lease = event.lease_token ?? '';
  if (!lease) return;
  let ok = false;
  try { ok = await send(event); } catch (error) { console.error('[document-request] delivery error', error); }
  const attempt = Math.max(0, Number(event.attempt_count ?? 0)) + 1;
  const next = ok ? null : new Date(Date.now() + Math.min(60, 2 ** Math.min(attempt, 6)) * 60_000).toISOString();
  await supabase.from('notification_events').update({
    status: ok ? 'sent' : 'failed',
    processed_at: new Date().toISOString(),
    last_attempt_at: new Date().toISOString(),
    attempt_count: attempt,
    next_attempt_at: next,
    last_error: ok ? null : 'Document request email delivery failed.',
    lease_token: null,
    lease_expires_at: null,
  }).eq('id', event.id).eq('lease_token', lease);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: 'Notification configuration incomplete.' });

  const suppliedSecret = request.headers.get('x-xdrive-webhook-secret') ?? '';
  const authorized = constantTimeEqual(bearer(request), serviceRoleKey)
    || (webhookSecret.length >= 32 && constantTimeEqual(suppliedSecret, webhookSecret));
  if (!authorized) return json(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => ({}));
  const eventId = body?.record?.id ?? body?.id ?? body?.event_id ?? null;
  if (typeof eventId !== 'string') return json(400, { error: 'event_id is required.' });

  const { data, error } = await supabase.rpc('claim_notification_events', { p_event_id: eventId, p_limit: 1 });
  if (error) return json(500, { error: error.message });
  const events = (data ?? []) as NotificationEvent[];
  for (const event of events) {
    if (!['onboarding_documents_required', 'onboarding_documents_reminder'].includes(event.event_type)) {
      // Release a wrongly routed lease without altering the event state.
      await supabase.from('notification_events').update({ lease_token: null, lease_expires_at: null }).eq('id', event.id).eq('lease_token', event.lease_token ?? '');
      continue;
    }
    await processEvent(event);
  }
  return json(200, { processed: events.length });
});
