import { Webhook } from 'svix';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

type ResendInvoiceEvent = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    tags?: Record<string, string>;
  };
};

const TRACKED_EVENTS = new Set([
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.delivery_delayed',
  'email.failed',
]);

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !supabaseAdmin) {
    return NextResponse.json({ error: 'Email webhook unavailable' }, { status: 503 });
  }

  const eventId = request.headers.get('svix-id')?.trim() ?? '';
  const timestamp = request.headers.get('svix-timestamp')?.trim() ?? '';
  const signature = request.headers.get('svix-signature')?.trim() ?? '';
  if (!eventId || !timestamp || !signature) {
    return NextResponse.json({ error: 'Missing email webhook signature headers' }, { status: 400 });
  }

  let event: ResendInvoiceEvent;
  try {
    const raw = await request.text();
    event = new Webhook(secret).verify(raw, {
      'svix-id': eventId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }) as unknown as ResendInvoiceEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid email webhook signature' }, { status: 400 });
  }

  if (!event || typeof event !== 'object' || typeof event.type !== 'string' || !event.data || typeof event.data !== 'object') {
    return NextResponse.json({ error: 'Invalid email event' }, { status: 400 });
  }

  if (!TRACKED_EVENTS.has(event.type)) {
    return NextResponse.json({ ignored: true });
  }

  const invoiceTag = event.data.tags?.xdrive_invoice;
  if (!invoiceTag || typeof invoiceTag !== 'string') {
    return NextResponse.json({ ignored: true });
  }

  if (
    !event.data.email_id
    || !Array.isArray(event.data.to)
    || event.data.to.length !== 1
    || typeof event.data.to[0] !== 'string'
    || !event.data.to[0].trim()
    || !Number.isFinite(Date.parse(event.created_at))
  ) {
    return NextResponse.json({ error: 'Invalid email event' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('apply_invoice_email_event', {
    p_id: eventId,
    p_message: event.data.email_id,
    p_type: event.type,
    p_created: event.created_at,
    p_recipient: event.data.to[0].trim(),
  });

  if (error) {
    return NextResponse.json(
      { error: 'Email event requires retry or finance reconciliation.' },
      { status: 503 },
    );
  }

  return NextResponse.json(data ?? { received: true });
}
