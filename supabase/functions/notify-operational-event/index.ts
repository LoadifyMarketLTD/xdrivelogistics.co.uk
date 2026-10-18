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
import { binaryToBase64, buildBookingAttachments, buildPodSummaryAttachment, type EmailAttachment } from './documentPdf.ts';

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

type SenderKind = 'confirmation' | 'pod' | 'invoices' | 'payments' | 'operations' | 'support' | 'alerts' | 'technical';

const senderFor = (kind: SenderKind) => {
  const senders: Record<SenderKind, string> = {
    confirmation: 'XDrive Confirmations <confirmation@xdrivelogistics.co.uk>',
    pod: 'XDrive POD <pod@xdrivelogistics.co.uk>',
    invoices: 'XDrive Invoices <invoices@xdrivelogistics.co.uk>',
    payments: 'XDrive Payments <payments@xdrivelogistics.co.uk>',
    operations: 'XDrive Operations <operations@xdrivelogistics.co.uk>',
    support: 'XDrive Support <support@xdrivelogistics.co.uk>',
    alerts: 'XDrive Alerts <alerts@xdrivelogistics.co.uk>',
    technical: fromEmail,
  };
  return senders[kind];
};
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
  const metadataName = String(metadata.full_name ?? metadata.name ?? '').trim();
  if (metadataName) return { email: data.user.email, name: metadataName };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_id')
    .eq('user_id', userId)
    .maybeSingle();

  const profileName = typeof profile?.full_name === 'string' ? profile.full_name.trim() : '';
  if (profileName) return { email: data.user.email, name: profileName };

  const companyId = typeof profile?.company_id === 'string' ? profile.company_id : null;
  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle();
    const companyName = typeof company?.name === 'string' ? company.name.trim() : '';
    if (companyName) return { email: data.user.email, name: companyName };
  }

  return { email: data.user.email, name: 'there' };
}

type PublicJobContext = {
  id: string;
  reference: string;
  pickup: string;
  delivery: string;
  deliveredAt: string;
};

const humanJobReference = (row: Record<string, unknown> | null, payload: Record<string, unknown>) => {
  const candidates = [
    payload.booking_reference,
    payload.customer_reference,
    payload.load_id,
    payload.job_reference,
    row?.booking_reference,
    row?.customer_reference,
    row?.load_id,
  ];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed && !isUuid(trimmed)) return trimmed;
  }
  return 'your booking';
};

async function getPublicJobContext(event: NotificationEvent): Promise<PublicJobContext> {
  const rawJobId = String(event.payload.job_id ?? event.entity_id ?? '').trim();
  let row: Record<string, unknown> | null = null;

  if (isUuid(rawJobId)) {
    const { data } = await supabase
      .from('jobs')
      .select('id, load_id, customer_reference, booking_reference, pickup_location, delivery_location, delivered_at, completed_at')
      .eq('id', rawJobId)
      .maybeSingle();
    row = (data as Record<string, unknown> | null) ?? null;
  }

  return {
    id: rawJobId,
    reference: humanJobReference(row, event.payload),
    pickup: String(event.payload.pickup_location ?? row?.pickup_location ?? 'Collection details available in XDrive'),
    delivery: String(event.payload.delivery_location ?? row?.delivery_location ?? 'Delivery details available in XDrive'),
    deliveredAt: String(event.payload.delivered_at ?? row?.delivered_at ?? row?.completed_at ?? ''),
  };
}

const formatEmailDateTime = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(parsed);
};

type BookingEmailContext = {
  reference: string;
  statusLabel: string;
  buyerName: string;
  carrierName: string;
  pickup: string;
  pickupDateTime: string;
  delivery: string;
  deliveryDateTime: string;
  customerReference: string;
  purchaseOrderNumber: string;
  vehicle: string;
  cargo: string;
  distanceMiles: number | null;
  agreedRate: number | null;
  currency: string;
  paymentTerms: string;
  notes: string;
  hardCopyPod: string;
  carrierCompanyId: string | null;
};

const numberOrNull = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

async function getBookingEmailContext(
  event: NotificationEvent,
  statusLabel = 'Booking Confirmation',
): Promise<BookingEmailContext> {
  const rawJobId = String(event.payload.job_id ?? event.entity_id ?? '').trim();
  let job: Record<string, unknown> = {};
  if (isUuid(rawJobId)) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id,company_id,awarded_carrier_company_id,assigned_company_id,booking_reference,customer_reference,purchase_order_number,pickup_location,pickup_postcode,pickup_datetime,delivery_location,delivery_postcode,delivery_datetime,requested_vehicle_label,requested_vehicle_type,vehicle_type,requested_cargo_label,cargo_type,job_distance_miles,load_details,special_requirements,hard_copy_pod')
      .eq('id', rawJobId)
      .maybeSingle();
    if (error) throw error;
    job = (data as Record<string, unknown> | null) ?? {};
  }

  const buyerCompanyId = typeof job.company_id === 'string' ? job.company_id : null;
  const carrierCompanyId = typeof job.awarded_carrier_company_id === 'string'
    ? job.awarded_carrier_company_id
    : typeof job.assigned_company_id === 'string'
      ? job.assigned_company_id
      : event.company_id;

  const companyIds = [buyerCompanyId, carrierCompanyId].filter((value): value is string => Boolean(value));
  const names = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data, error } = await supabase.from('companies').select('id,name').in('id', companyIds);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id?: string; name?: string }>) {
      if (row.id && row.name) names.set(row.id, row.name);
    }
  }

  let agreement: Record<string, unknown> = {};
  if (isUuid(rawJobId)) {
    const { data } = await supabase
      .from('job_commercial_agreements_effective')
      .select('*')
      .eq('job_id', rawJobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    agreement = (data as Record<string, unknown> | null) ?? {};
  }

  let bid: Record<string, unknown> = {};
  const rawBidId = String(event.payload.bid_id ?? (event.entity_type === 'bid' ? event.entity_id : '') ?? '').trim();
  if (isUuid(rawBidId)) {
    const { data } = await supabase
      .from('job_bids')
      .select('bid_price_gbp,amount,currency')
      .eq('id', rawBidId)
      .maybeSingle();
    bid = (data as Record<string, unknown> | null) ?? {};
  }

  const reference = humanJobReference(job, event.payload);
  const pickupLocation = [job.pickup_location, job.pickup_postcode]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(', ');
  const deliveryLocation = [job.delivery_location, job.delivery_postcode]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(', ');
  const requestedVehicle = String(
    job.requested_vehicle_label ?? job.requested_vehicle_type ?? job.vehicle_type ?? '',
  ).trim();
  const cargo = String(job.requested_cargo_label ?? job.cargo_type ?? '').trim();
  const agreedRate = numberOrNull(agreement.agreed_amount)
    ?? numberOrNull(event.payload.bid_price_gbp)
    ?? numberOrNull(event.payload.amount)
    ?? numberOrNull(bid.bid_price_gbp)
    ?? numberOrNull(bid.amount);
  const currency = String(agreement.currency ?? bid.currency ?? event.payload.currency ?? 'GBP').trim() || 'GBP';
  const paymentTerms = String(agreement.payment_terms ?? event.payload.payment_terms ?? '').trim();
  const notes = [job.load_details, job.special_requirements]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' | ');

  return {
    reference,
    statusLabel,
    buyerName: buyerCompanyId ? (names.get(buyerCompanyId) ?? 'Booking company') : 'Booking company',
    carrierName: carrierCompanyId ? (names.get(carrierCompanyId) ?? 'Carrier') : 'Carrier',
    pickup: pickupLocation || String(event.payload.pickup_location ?? ''),
    pickupDateTime: formatEmailDateTime(String(job.pickup_datetime ?? event.payload.pickup_datetime ?? '')),
    delivery: deliveryLocation || String(event.payload.delivery_location ?? ''),
    deliveryDateTime: formatEmailDateTime(String(job.delivery_datetime ?? event.payload.delivery_datetime ?? '')),
    customerReference: String(job.customer_reference ?? event.payload.customer_reference ?? '').trim(),
    purchaseOrderNumber: String(job.purchase_order_number ?? '').trim(),
    vehicle: requestedVehicle,
    cargo,
    distanceMiles: numberOrNull(job.job_distance_miles),
    agreedRate,
    currency,
    paymentTerms,
    notes,
    hardCopyPod: String(job.hard_copy_pod ?? '').trim(),
    carrierCompanyId,
  };
}

const safePodStoragePath = (jobId: string, value: unknown): value is string => {
  if (!isUuid(jobId) || typeof value !== 'string') return false;
  const path = value.trim();
  if (!path || path.length > 1024 || path.includes('://') || path.includes('..') || path.includes('\\') || path.startsWith('/')) return false;
  const segments = path.split('/');
  return segments.length >= 3 && segments[1] === jobId && Boolean(segments[0]) && Boolean(segments.at(-1));
};

const signatureEvidencePath = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const candidate = (value as Record<string, unknown>).evidence_path;
  return typeof candidate === 'string' ? candidate.trim() : '';
};

const attachmentContentType = (path: string, fallback = 'application/octet-stream') => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return fallback;
};

async function loadPodEmailBundle(event: NotificationEvent) {
  const job = await getPublicJobContext(event);
  if (!isUuid(job.id)) {
    return {
      job,
      receivedBy: '',
      leftAt: '',
      deliveryStatus: '',
      itemCount: null as number | null,
      deliveryNotes: '',
      deliveredOn: job.deliveredAt,
      attachments: [] as EmailAttachment[],
    };
  }

  const [{ data: jobRow, error: jobError }, { data: proofRow, error: proofError }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id,delivery_photos,damage_photos,pod_photos,delivery_signature_data,client_signature_name')
      .eq('id', job.id)
      .maybeSingle(),
    supabase
      .from('proof_of_delivery')
      .select('delivered_on,received_by,left_at,no_of_items,delivery_status,delivery_notes,photo_urls,created_at')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (jobError) throw jobError;
  if (proofError) throw proofError;

  const row = (jobRow as Record<string, unknown> | null) ?? {};
  const proof = (proofRow as Record<string, unknown> | null) ?? {};
  const receivedBy = String(proof.received_by ?? row.client_signature_name ?? '').trim();
  const leftAt = String(proof.left_at ?? '').trim();
  const deliveryStatus = String(proof.delivery_status ?? '').trim();
  const deliveryNotes = String(proof.delivery_notes ?? '').trim();
  const deliveredOnRaw = String(proof.delivered_on ?? job.deliveredAt ?? '').trim();
  const deliveredOn = formatEmailDateTime(deliveredOnRaw) || deliveredOnRaw;
  const itemCount = numberOrNull(proof.no_of_items);

  const candidatePaths: string[] = [];
  const pushPaths = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const entry of value) {
      if (safePodStoragePath(job.id, entry)) candidatePaths.push(entry);
    }
  };
  pushPaths(row.delivery_photos);
  pushPaths(row.damage_photos);
  pushPaths(row.pod_photos);
  pushPaths(proof.photo_urls);
  const signaturePath = signatureEvidencePath(row.delivery_signature_data);
  if (safePodStoragePath(job.id, signaturePath)) candidatePaths.push(signaturePath);

  const uniquePaths = [...new Set(candidatePaths)].slice(0, 8);
  const evidenceAttachments: EmailAttachment[] = [];
  let totalBytes = 0;
  for (const storagePath of uniquePaths) {
    if (totalBytes >= 18 * 1024 * 1024) break;
    const { data, error } = await supabase.storage.from('pod-photos').download(storagePath);
    if (error || !data) {
      console.error(`[notify] Could not attach POD evidence ${storagePath}: ${error?.message ?? 'not found'}`);
      continue;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 7 * 1024 * 1024 || totalBytes + bytes.length > 18 * 1024 * 1024) continue;
    totalBytes += bytes.length;
    const filename = storagePath.split('/').at(-1) || 'pod-evidence';
    evidenceAttachments.push({
      filename,
      content: binaryToBase64(bytes),
      content_type: attachmentContentType(filename, data.type || 'application/octet-stream'),
    });
  }

  const summary = buildPodSummaryAttachment({
    reference: job.reference,
    pickup: job.pickup,
    delivery: job.delivery,
    deliveredOn,
    receivedBy,
    leftAt,
    deliveryStatus,
    itemCount,
    deliveryNotes,
  });

  return {
    job,
    receivedBy,
    leftAt,
    deliveryStatus,
    itemCount,
    deliveryNotes,
    deliveredOn,
    attachments: [summary, ...evidenceAttachments],
  };
}

async function getPublicInvoiceReference(event: NotificationEvent) {
  const payloadNumber = typeof event.payload.invoice_number === 'string'
    ? event.payload.invoice_number.trim()
    : '';
  if (payloadNumber && !isUuid(payloadNumber)) return payloadNumber;

  const rawInvoiceId = String(event.payload.invoice_id ?? event.entity_id ?? '').trim();
  if (isUuid(rawInvoiceId)) {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('id', rawInvoiceId)
      .maybeSingle();
    const invoiceNumber = typeof data?.invoice_number === 'string' ? data.invoice_number.trim() : '';
    if (invoiceNumber && !isUuid(invoiceNumber)) return invoiceNumber;
  }

  return rawInvoiceId && !isUuid(rawInvoiceId) ? rawInvoiceId : 'your invoice';
}

const notificationEventClass = (eventType: string) => {
  if (['load_alert', 'bid_accepted', 'bid_rejected', 'carrier_invited', 'carrier_accepted', 'carrier_rejected'].includes(eventType)) return 'marketplace';
  if (['invoice_created', 'invoice_dispute', 'invoice_disputed', 'invoice_paid', 'payment_received'].includes(eventType)) return 'finance';
  if (eventType.startsWith('onboarding_') || ['membership_invite', 'membership_changed'].includes(eventType)) return 'account';
  return 'operational';
};

async function userEmailEnabled(userId: string, eventType: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('email_enabled')
    .eq('user_id', userId)
    .eq('event_class', notificationEventClass(eventType))
    .maybeSingle();
  if (error) throw error;
  return data?.email_enabled ?? true;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
  sender: SenderKind = 'technical',
  attachments: EmailAttachment[] = [],
): Promise<boolean> {
  const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
  if (uuidPattern.test(subject) || uuidPattern.test(html)) {
    console.error('[notify] External email blocked because it contains an internal UUID.');
    return false;
  }

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
    body: JSON.stringify({
      from: senderFor(sender),
      to,
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    }),
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
  // If a notification explicitly requests push, missing Firebase credentials
  // are a delivery failure, not a successful no-op. The queue must remain
  // retryable until push transport is configured instead of falsely marking the
  // event sent.
  if (!firebaseServiceAccount) {
    console.error('[notify] FIREBASE_SERVICE_ACCOUNT_JSON is not configured; requested push was not sent.');
    return false;
  }

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
  eventType: string,
  subject: string,
  htmlFor: (safeName: string) => string,
  eventId: string,
  sender: SenderKind = 'technical',
  attachments: EmailAttachment[] = [],
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
      if (!await userEmailEnabled(member.user_id, eventType)) return true;
      const user = await getUserEmail(member.user_id);
      return user
        ? sendEmail(
          user.email,
          subject,
          htmlFor(escapeHtml(user.name)),
          notificationIdempotencyKey(eventId, member.user_id),
          sender,
          attachments,
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
  const emailEnabled = await userEmailEnabled(userId, event.event_type);
  const jobIdRaw = String(event.payload.job_id ?? event.entity_id);
  const pickup = escapeHtml(event.payload.pickup_location ?? 'TBC');
  const delivery = escapeHtml(event.payload.delivery_location ?? 'TBC');
  const [emailOk, pushOk] = await Promise.all([
    emailEnabled ? sendEmail(
      user.email,
      'New Job Assigned - XDrive Logistics',
      `<h2>You have a new job assigned</h2><p>Hi ${escapeHtml(user.name)},</p><p>A new job has been assigned to you.</p><ul><li><strong>Pickup:</strong> ${pickup}</li><li><strong>Delivery:</strong> ${delivery}</li></ul><p><a href="${escapeHtml(buildAppUrl('/driver/jobs'))}">View job details</a></p><p>XDrive Logistics</p>`,
      notificationIdempotencyKey(event.id, userId),
      'operations',
    ) : true,
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

async function handleCommercialAmendment(event: NotificationEvent) {
  const job = await getPublicJobContext(event);
  const jobId = job.id;
  const jobReference = job.reference;
  const amendmentId = String(event.payload.amendment_id ?? '');
  const version = String(event.payload.version_number ?? '?');
  const reason = String(event.payload.reason ?? 'Booking details changed.').trim();
  const deepLink = `xdrive://job/${jobId}`;

  if (event.event_type === 'commercial_amendment_proposed') {
    const companyId = event.company_id
      ?? (typeof event.payload.counterparty_company_id === 'string' ? event.payload.counterparty_company_id : null);
    const userId = event.recipient_user_id;

    const [companyEmailOk, pushOk] = await Promise.all([
      companyId
        ? emailCompanyOperators(
          companyId,
          event.event_type,
          'Job change requires acceptance - XDrive Logistics',
          (name) =>
            `<h2>Job change requires acceptance</h2><p>Hi ${name},</p><p>Booking <strong>${escapeHtml(jobReference)}</strong> has a proposed change (version ${escapeHtml(version)}).</p><p><strong>Reason:</strong> ${escapeHtml(reason)}</p><p>The original booking remains active until your company or the assigned driver accepts the change in XDrive.</p><p><a href="${escapeHtml(buildAppUrl('/carrier/diary'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
          event.id,
          'confirmation',
        )
        : true,
      userId
        ? sendDriverPush(
          userId,
          'Job Change Requires Acceptance',
          `Booking ${jobReference} has changed. Open XDrive to review OLD → NEW details and accept or reject.`,
          {
            event_type: 'commercial_amendment_proposed',
            job_id: jobId,
            amendment_id: amendmentId,
            deep_link: deepLink,
          },
        )
        : true,
    ]);
    return companyEmailOk && pushOk;
  }

  const accepted = event.event_type === 'commercial_amendment_accepted';
  const bookingContext = accepted
    ? await getBookingEmailContext(event, 'Edited Booking Confirmation')
    : null;
  const attachments = bookingContext ? buildBookingAttachments(bookingContext) : [];
  const subject = accepted
    ? `EDITED Booking Confirmation - Ref: ${jobReference}`
    : `Job change rejected - Ref: ${jobReference}`;
  const htmlFor = (name: string) => accepted
    ? `<h2>Booking updated</h2><p>Hi ${name},</p><p>Booking <strong>${escapeHtml(jobReference)}</strong> amendment version ${escapeHtml(version)} was <strong>accepted</strong>.</p><p>The accepted version is now the active booking. Updated Booking Confirmation and Delivery Note are attached.</p><p><a href="${escapeHtml(buildAppUrl('/customer/jobs'))}">Open booking history</a></p><p>XDrive Logistics</p>`
    : `<h2>Job change rejected</h2><p>Hi ${name},</p><p>Booking <strong>${escapeHtml(jobReference)}</strong> amendment version ${escapeHtml(version)} was <strong>rejected</strong>.</p><p>The previously accepted booking remains active.</p><p><a href="${escapeHtml(buildAppUrl('/customer/jobs'))}">Open booking history</a></p><p>XDrive Logistics</p>`;

  const results: boolean[] = [];
  const userId = event.recipient_user_id;
  if (userId && await userEmailEnabled(userId, event.event_type)) {
    const user = await getUserEmail(userId);
    if (user) {
      results.push(await sendEmail(
        user.email,
        subject,
        htmlFor(escapeHtml(user.name)),
        notificationIdempotencyKey(event.id, userId),
        'confirmation',
        attachments,
      ));
    }
  }

  const companyId = event.company_id;
  if (companyId) {
    results.push(await emailCompanyOperators(
      companyId,
      event.event_type,
      subject,
      htmlFor,
      event.id,
      'confirmation',
      attachments,
    ));
  }
  return results.length === 0 ? true : results.every(Boolean);
}

async function handleBidAccepted(event: NotificationEvent) {
  const context = await getBookingEmailContext(event, 'Booking Confirmation');
  const attachments = buildBookingAttachments(context);
  const userId = typeof event.payload.bidder_user_id === 'string' ? event.payload.bidder_user_id : null;
  const companyId = context.carrierCompanyId ?? event.company_id;
  const rate = typeof context.agreedRate === 'number'
    ? `${escapeHtml(context.currency)} ${escapeHtml(context.agreedRate.toFixed(2))}`
    : '';
  const subject = `Booking Confirmation - Ref: ${context.reference}`;
  const htmlFor = (name: string) => `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1f2937;line-height:1.55">
      <h2 style="margin:0 0 18px">Booking confirmed</h2>
      <p>Hi ${name},</p>
      <p>The booking <strong>${escapeHtml(context.reference)}</strong> is now confirmed.</p>
      <table style="border-collapse:collapse;width:100%;margin:18px 0">
        <tr><td style="padding:7px 0;font-weight:700;width:150px">Booking ref</td><td style="padding:7px 0">${escapeHtml(context.reference)}</td></tr>
        <tr><td style="padding:7px 0;font-weight:700">Collection</td><td style="padding:7px 0">${escapeHtml(context.pickupDateTime || '')}${context.pickupDateTime && context.pickup ? '<br>' : ''}${escapeHtml(context.pickup)}</td></tr>
        <tr><td style="padding:7px 0;font-weight:700">Delivery</td><td style="padding:7px 0">${escapeHtml(context.deliveryDateTime || '')}${context.deliveryDateTime && context.delivery ? '<br>' : ''}${escapeHtml(context.delivery)}</td></tr>
        ${context.vehicle ? `<tr><td style="padding:7px 0;font-weight:700">Vehicle</td><td style="padding:7px 0">${escapeHtml(context.vehicle)}</td></tr>` : ''}
        ${rate ? `<tr><td style="padding:7px 0;font-weight:700">Agreed rate</td><td style="padding:7px 0">${rate}</td></tr>` : ''}
        ${context.paymentTerms ? `<tr><td style="padding:7px 0;font-weight:700">Payment terms</td><td style="padding:7px 0">${escapeHtml(context.paymentTerms)}</td></tr>` : ''}
      </table>
      <p><strong>Attached:</strong> Booking Confirmation and Delivery Note.</p>
      <p><a href="${escapeHtml(buildAppUrl('/'))}" style="display:inline-block;padding:11px 18px;background:#1f2937;color:#fff;border-radius:7px;text-decoration:none;font-weight:700">Open XDrive</a></p>
      <p style="color:#64748b">Keep the attached documents with the booking record. If the commercial booking is amended and accepted, XDrive will issue an updated confirmation.</p>
      <p>XDrive Logistics</p>
    </div>`;

  const results: boolean[] = [];
  if (userId && await userEmailEnabled(userId, event.event_type)) {
    const user = await getUserEmail(userId);
    if (user) {
      results.push(await sendEmail(
        user.email,
        subject,
        htmlFor(escapeHtml(user.name)),
        notificationIdempotencyKey(event.id, userId),
        'confirmation',
        attachments,
      ));
    }
  }

  if (companyId) {
    results.push(await emailCompanyOperators(
      companyId,
      event.event_type,
      subject,
      htmlFor,
      event.id,
      'confirmation',
      attachments,
    ));
  }

  return results.length === 0 ? true : results.every(Boolean);
}

async function handlePodUploaded(event: NotificationEvent) {
  const companyId = typeof event.payload.company_id === 'string'
    ? event.payload.company_id
    : event.company_id;
  if (!companyId) return true;

  const bundle = await loadPodEmailBundle(event);
  const podStatus = bundle.deliveryStatus || (event.payload.pod_status === 'pending' ? 'Pending review' : 'Available');
  const subject = `POD - ${bundle.job.pickup} to ${bundle.job.delivery} - Ref: ${bundle.job.reference}`;

  return emailCompanyOperators(
    companyId,
    event.event_type,
    subject,
    (name) => `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#1f2937;line-height:1.55">
        <h2 style="margin:0 0 18px">Proof of Delivery</h2>
        <p>Hi ${name},</p>
        <p>The POD for booking <strong>${escapeHtml(bundle.job.reference)}</strong> is now available.</p>
        <table style="border-collapse:collapse;width:100%;margin:18px 0">
          <tr><td style="padding:7px 0;font-weight:700;width:145px">Booking ref</td><td style="padding:7px 0">${escapeHtml(bundle.job.reference)}</td></tr>
          <tr><td style="padding:7px 0;font-weight:700">From</td><td style="padding:7px 0">${escapeHtml(bundle.job.pickup)}</td></tr>
          <tr><td style="padding:7px 0;font-weight:700">To</td><td style="padding:7px 0">${escapeHtml(bundle.job.delivery)}</td></tr>
          ${bundle.deliveredOn ? `<tr><td style="padding:7px 0;font-weight:700">Delivered on</td><td style="padding:7px 0">${escapeHtml(bundle.deliveredOn)}</td></tr>` : ''}
          ${bundle.receivedBy ? `<tr><td style="padding:7px 0;font-weight:700">Received by</td><td style="padding:7px 0">${escapeHtml(bundle.receivedBy)}</td></tr>` : ''}
          ${bundle.leftAt ? `<tr><td style="padding:7px 0;font-weight:700">Left at</td><td style="padding:7px 0">${escapeHtml(bundle.leftAt)}</td></tr>` : ''}
          ${typeof bundle.itemCount === 'number' ? `<tr><td style="padding:7px 0;font-weight:700">Items</td><td style="padding:7px 0">${escapeHtml(bundle.itemCount)}</td></tr>` : ''}
          <tr><td style="padding:7px 0;font-weight:700">Delivery status</td><td style="padding:7px 0">${escapeHtml(podStatus)}</td></tr>
          ${bundle.deliveryNotes ? `<tr><td style="padding:7px 0;font-weight:700">Delivery notes</td><td style="padding:7px 0">${escapeHtml(bundle.deliveryNotes)}</td></tr>` : ''}
        </table>
        <p><strong>Attached:</strong> POD summary${bundle.attachments.length > 1 ? ' and supporting delivery evidence' : ''}.</p>
        <p><a href="${escapeHtml(buildAppUrl('/'))}" style="display:inline-block;padding:11px 18px;background:#1f2937;color:#fff;border-radius:7px;text-decoration:none;font-weight:700">View POD in XDrive</a></p>
        <p style="color:#64748b">The attached evidence forms part of the delivery record retained in XDrive.</p>
        <p>XDrive Logistics</p>
      </div>`,
    event.id,
    'pod',
    bundle.attachments,
  );
}

async function handleLoadAlert(event: NotificationEvent) {
  const userId = event.recipient_user_id;
  if (!userId) return true;

  const emailEnabled = event.payload.email_enabled === true && await userEmailEnabled(userId, event.event_type);
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
        'alerts',
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

async function handleOperationalSmartAlert(event: NotificationEvent) {
  const userId = event.recipient_user_id;
  if (!userId) return true;

  const titles: Record<string, string> = {
    pickup_proximity_alert: 'Driver near pickup',
    delivery_proximity_alert: 'Driver near delivery',
    tracking_eta_alert: 'Delivery ETA alert',
    job_on_site_pickup_alert: 'Driver on site at pickup',
    job_loaded_alert: 'Load collected',
    job_on_site_delivery_alert: 'Driver on site at delivery',
    job_pod_submitted_alert: 'POD submitted',
  };
  const title = titles[event.event_type] ?? 'Booking update';
  const sender: SenderKind = event.event_type === 'job_pod_submitted_alert' ? 'pod' : 'operations';
  const jobId = String(event.payload.job_id ?? event.entity_id);
  const message = String(event.payload.message ?? title);
  const emailEnabled = event.payload.email_enabled === true && await userEmailEnabled(userId, event.event_type);
  const pushEnabled = event.payload.push_enabled === true;
  if (!emailEnabled && !pushEnabled) return true;

  let emailOk = true;
  if (emailEnabled) {
    const user = await getUserEmail(userId);
    if (user) {
      const pickup = event.payload.pickup_outcode ? `<li><strong>Pickup area:</strong> ${escapeHtml(event.payload.pickup_outcode)}</li>` : '';
      const delivery = event.payload.delivery_outcode ? `<li><strong>Delivery area:</strong> ${escapeHtml(event.payload.delivery_outcode)}</li>` : '';
      emailOk = await sendEmail(
        user.email,
        `${title} - XDrive Logistics`,
        `<h2>${escapeHtml(title)}</h2><p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(message)}</p><ul>${pickup}${delivery}</ul><p><a href="${escapeHtml(buildAppUrl('/'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
        notificationIdempotencyKey(event.id, userId),
        sender,
      );
    }
  }

  const pushOk = pushEnabled
    ? await sendDriverPush(
      userId,
      title,
      message,
      {
        event_type: event.event_type,
        job_id: jobId,
        deep_link: `xdrive://job/${jobId}`,
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
  if (!await userEmailEnabled(userId, event.event_type)) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  const onboardingUrl = safeOnboardingUrl(event.payload.onboarding_url);
  const accountType = escapeHtml(String(event.payload.account_type ?? 'account').replaceAll('_', ' '));
  return sendEmail(
    user.email,
    'Complete onboarding - XDrive Logistics',
    `<h2>Your XDrive onboarding is ready</h2><p>Hi ${escapeHtml(user.name)},</p><p>Continue onboarding to unlock your workspace.</p><p><strong>Account type:</strong> ${accountType}</p><p><a href="${escapeHtml(onboardingUrl)}">Start or resume onboarding</a></p><p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
    'support',
  );
}

async function handleComplianceDocumentReminder(event: NotificationEvent) {
  const userId = event.recipient_user_id;
  if (!userId) return false;
  if (!await userEmailEnabled(userId, event.event_type)) return true;
  const user = await getUserEmail(userId);
  if (!user) return false;

  const missingDocuments = Array.isArray(event.payload.missing_documents)
    ? event.payload.missing_documents.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const documentType = typeof event.payload.document_type === 'string'
    ? event.payload.document_type.trim()
    : '';
  const message = typeof event.payload.message === 'string' && event.payload.message.trim()
    ? event.payload.message.trim()
    : event.event_type === 'compliance_document_expiring'
      ? 'A compliance document is approaching expiry.'
      : 'Required compliance documents are still outstanding.';
  const rawActionUrl = typeof event.payload.action_url === 'string' ? event.payload.action_url : '/admin/documents';
  const actionUrl = buildAppUrl(rawActionUrl.startsWith('/') ? rawActionUrl : '/admin/documents');
  const list = missingDocuments.length
    ? `<ul>${missingDocuments.map((item) => `<li style="margin:6px 0"><strong>${escapeHtml(item.replaceAll('_', ' '))}</strong></li>`).join('')}</ul>`
    : documentType
      ? `<p><strong>Document:</strong> ${escapeHtml(documentType.replaceAll('_', ' '))}</p>`
      : '';

  return sendEmail(
    user.email,
    event.event_type === 'compliance_document_expiring'
      ? 'Compliance document expiry reminder - XDrive Logistics'
      : 'Compliance documents required - XDrive Logistics',
    `<h2>${event.event_type === 'compliance_document_expiring' ? 'Document expiry approaching' : 'Compliance documents required'}</h2><p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(message)}</p>${list}<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:11px 18px;background:#1d57d8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Review documents</a></p><p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
    'support',
  );
}

async function handleOnboardingDocumentsRequired(event: NotificationEvent) {
  const userId = event.recipient_user_id
    ?? (typeof event.payload.recipient_user_id === 'string' ? event.payload.recipient_user_id : null);
  if (!userId) return false;
  if (!await userEmailEnabled(userId, event.event_type)) return true;
  const user = await getUserEmail(userId);
  if (!user) return false;

  const documents = Array.isArray(event.payload.missing_documents)
    ? event.payload.missing_documents.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (!documents.length) {
    console.error(`[notify] Document request event ${event.id} has no canonical missing_documents payload.`);
    return false;
  }

  const reminder = event.event_type === 'onboarding_documents_reminder';
  const onboardingUrl = safeOnboardingUrl(event.payload.onboarding_url);
  const list = documents
    .map((document) => `<li style="margin:6px 0"><strong>${escapeHtml(document.replaceAll('_', ' '))}</strong></li>`)
    .join('');
  const reason = typeof event.payload.reason === 'string' && event.payload.reason.trim()
    ? `<p><strong>Message from XDrive:</strong> ${escapeHtml(event.payload.reason)}</p>`
    : '';

  return sendEmail(
    user.email,
    reminder
      ? 'Reminder: documents required to complete your XDrive onboarding'
      : 'Documents required to complete your XDrive onboarding',
    `<h2>${reminder ? 'Your onboarding is still incomplete' : 'Please complete your XDrive documents'}</h2><p>Hi ${escapeHtml(user.name)},</p><p>${reminder ? 'The following required documents are still outstanding:' : 'To continue your XDrive onboarding, please upload or correct the following required documents:'}</p><ul>${list}</ul>${reason}<p><a href="${escapeHtml(onboardingUrl)}" style="display:inline-block;padding:11px 18px;background:#1d57d8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Complete your documents</a></p><p>This request remains outstanding until the required documents are uploaded and approved.</p><p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
    'support',
  );
}

async function handleOnboardingCompletionRequired(event: NotificationEvent) {
  const userId = event.recipient_user_id
    ?? (typeof event.payload.recipient_user_id === 'string' ? event.payload.recipient_user_id : null);
  if (!userId) return false;
  if (!await userEmailEnabled(userId, event.event_type)) return true;
  const user = await getUserEmail(userId);
  if (!user) return false;

  const fields = Array.isArray(event.payload.missing_fields)
    ? event.payload.missing_fields.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const documents = Array.isArray(event.payload.missing_documents)
    ? event.payload.missing_documents.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const blockers = Array.isArray(event.payload.blocking_reasons)
    ? event.payload.blocking_reasons.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (!fields.length && !documents.length && !blockers.length) {
    console.error(`[notify] Onboarding completion event ${event.id} has no missing requirements payload.`);
    return false;
  }

  const reminder = event.event_type === 'onboarding_reminder';
  const onboardingUrl = safeOnboardingUrl(event.payload.onboarding_url);
  const reason = typeof event.payload.reason === 'string' && event.payload.reason.trim()
    ? `<p><strong>Message from XDrive:</strong> ${escapeHtml(event.payload.reason)}</p>`
    : '';
  const fieldList = fields.length
    ? `<p><strong>Information still required:</strong></p><ul>${fields.map((item) => `<li style="margin:6px 0">${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const documentList = documents.length
    ? `<p><strong>Documents still required:</strong></p><ul>${documents.map((item) => `<li style="margin:6px 0">${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const blockerList = blockers.length
    ? `<p><strong>Other actions still required:</strong></p><ul>${blockers.map((item) => `<li style="margin:6px 0">${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';

  return sendEmail(
    user.email,
    reminder
      ? 'Reminder: complete your XDrive onboarding'
      : 'Action required: complete your XDrive onboarding',
    `<h2>${reminder ? 'Your XDrive onboarding is still incomplete' : 'Please complete your XDrive onboarding'}</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your previous progress has been saved. XDrive now checks the current onboarding requirements and only asks you to complete the items that are still missing.</p>${fieldList}${documentList}${blockerList}${reason}<p><a href="${escapeHtml(onboardingUrl)}" style="display:inline-block;padding:11px 18px;background:#1d57d8;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Resume onboarding</a></p><p>You do not need to start again. Existing valid information and uploaded documents remain attached to your application.</p><p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
    'support',
  );
}

async function handleOnboardingSubmitted(event: NotificationEvent) {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return true;
  if (!await userEmailEnabled(userId, event.event_type)) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  const accountType = escapeHtml(String(event.payload.account_type ?? 'account').replaceAll('_', ' '));
  const rawReference = String(event.payload.onboarding_application_id ?? '').trim();
  const referenceLine = rawReference && !isUuid(rawReference)
    ? `<p>Reference: <strong>${escapeHtml(rawReference)}</strong></p>`
    : '';
  return sendEmail(
    user.email,
    'Onboarding submitted - XDrive Logistics',
    `<h2>Onboarding submitted</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your ${accountType} onboarding has been submitted for review.</p>${referenceLine}<p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
    'support',
  );
}

async function handleOnboardingApproved(event: NotificationEvent) {
  const userId = event.recipient_user_id ?? (event.payload.recipient_user_id as string | undefined);
  if (!userId) return true;
  if (!await userEmailEnabled(userId, event.event_type)) return true;
  const user = await getUserEmail(userId);
  if (!user) return true;
  return sendEmail(
    user.email,
    'Onboarding approved - XDrive Logistics',
    `<h2>Your XDrive workspace is approved</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your onboarding has been approved. You can now sign in and use your workspace.</p><p><a href="${escapeHtml(buildAppUrl('/login'))}">Open XDrive</a></p><p>XDrive Logistics</p>`,
    notificationIdempotencyKey(event.id, userId),
    'support',
  );
}

async function handleInvoiceDisputed(event: NotificationEvent) {
  const invoiceReference = escapeHtml(await getPublicInvoiceReference(event));
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  if (event.recipient_user_id) {
    if (!await userEmailEnabled(event.recipient_user_id, event.event_type)) return true;
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return true;
    return sendEmail(
      user.email,
      'Invoice disputed - XDrive Logistics',
      `<h2>Invoice disputed</h2><p>Hi ${escapeHtml(user.name)},</p><p>Invoice <strong>${invoiceReference}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
      notificationIdempotencyKey(event.id, event.recipient_user_id),
      'invoices',
    );
  }
  if (!companyId) return true;
  return emailCompanyOperators(
    companyId,
    event.event_type,
    'Invoice disputed - XDrive Logistics',
    (name) => `<h2>Invoice disputed</h2><p>Hi ${name},</p><p>Invoice <strong>${invoiceReference}</strong> has been disputed.</p><p>Please review it in your finance workspace.</p><p>XDrive Logistics</p>`,
    event.id,
    'invoices',
  );
}

async function handlePaymentReceived(event: NotificationEvent) {
  const invoiceReference = escapeHtml(await getPublicInvoiceReference(event));
  const companyId = event.company_id ?? (event.payload.company_id as string | undefined);
  const rawAmount = event.payload.amount_gbp ?? event.payload.amount ?? event.payload.payment_amount;
  const amount = typeof rawAmount === 'number'
    ? rawAmount
    : typeof rawAmount === 'string' && rawAmount.trim() ? Number(rawAmount) : null;
  const amountLine = typeof amount === 'number' && Number.isFinite(amount)
    ? `<p><strong>Amount received:</strong> £${escapeHtml(amount.toFixed(2))}</p>`
    : '';
  const subject = `Payment received - Invoice ${invoiceReference}`;
  const htmlFor = (name: string) =>
    `<h2>Payment received</h2><p>Hi ${name},</p><p>Payment has been recorded against invoice <strong>${invoiceReference}</strong>.</p>${amountLine}<p><a href="${escapeHtml(buildAppUrl('/admin/finance/customer-invoices'))}">Open Finance</a></p><p>XDrive Logistics</p>`;

  if (event.recipient_user_id) {
    if (!await userEmailEnabled(event.recipient_user_id, event.event_type)) return true;
    const user = await getUserEmail(event.recipient_user_id);
    if (!user) return true;
    return sendEmail(
      user.email,
      subject,
      htmlFor(escapeHtml(user.name)),
      notificationIdempotencyKey(event.id, event.recipient_user_id),
      'payments',
    );
  }

  if (!companyId) return true;
  return emailCompanyOperators(
    companyId,
    event.event_type,
    subject,
    htmlFor,
    event.id,
    'payments',
  );
}

async function handleInvoiceCreated(_event: NotificationEvent) {
  // Invoice creation is an internal workspace event. Do not send a second
  // email that can be mistaken for the commercial invoice itself.
  // The actual invoice email, with the issuer-branded PDF attached, is sent
  // only by the invoice delivery worker after POD/PDF validation succeeds.
  return true;
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
      case 'commercial_amendment_proposed':
      case 'commercial_amendment_accepted':
      case 'commercial_amendment_rejected':
        success = await handleCommercialAmendment(event);
        break;
      case 'bid_accepted': success = await handleBidAccepted(event); break;
      case 'pod_uploaded': success = await handlePodUploaded(event); break;
      case 'load_alert': success = await handleLoadAlert(event); break;
      case 'pickup_proximity_alert':
      case 'delivery_proximity_alert':
      case 'tracking_eta_alert':
      case 'job_on_site_pickup_alert':
      case 'job_loaded_alert':
      case 'job_on_site_delivery_alert':
      case 'job_pod_submitted_alert':
        success = await handleOperationalSmartAlert(event);
        break;
      case 'onboarding_invite':
      case 'onboarding_invite_resent':
        success = await handleOnboardingInvite(event);
        break;
      case 'compliance_documents_missing':
      case 'compliance_document_expiring':
        success = await handleComplianceDocumentReminder(event);
        break;
      case 'onboarding_documents_required':
      case 'onboarding_documents_reminder':
        success = await handleOnboardingDocumentsRequired(event);
        break;
      case 'onboarding_completion_required':
      case 'onboarding_reminder':
        success = await handleOnboardingCompletionRequired(event);
        break;
      case 'onboarding_submitted': success = await handleOnboardingSubmitted(event); break;
      case 'onboarding_approved': success = await handleOnboardingApproved(event); break;
      case 'invoice_disputed': success = await handleInvoiceDisputed(event); break;
      case 'invoice_paid':
      case 'payment_received':
        success = await handlePaymentReceived(event);
        break;
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