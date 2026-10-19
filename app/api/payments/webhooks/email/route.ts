import { Webhook } from 'svix';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !supabaseAdmin) return NextResponse.json({ error: 'Email webhook unavailable' }, { status: 503 });
  let event: { type: string; created_at: string; data: { email_id: string; to: string[]; tags?: Record<string, string> } };
  const eventId = request.headers.get('svix-id') ?? '';
  try {
    const raw = await request.text();
    new Webhook(secret).verify(raw, { 'svix-id': eventId, 'svix-timestamp': request.headers.get('svix-timestamp') ?? '', 'svix-signature': request.headers.get('svix-signature') ?? '' });
    event = JSON.parse(raw) as typeof event;
  } catch { return NextResponse.json({ error: 'Invalid email webhook signature' }, { status: 400 }); }
  if (!event || typeof event !== 'object') return NextResponse.json({ error: 'Invalid email event' }, { status: 400 });
  if (!['email.delivered','email.bounced','email.complained','email.delivery_delayed','email.failed'].includes(event.type)) return NextResponse.json({ ignored: true });
  if (!event.data?.tags?.xdrive_invoice) return NextResponse.json({ ignored: true });
  if (!event.data?.email_id || !Array.isArray(event.data.to) || event.data.to.length !== 1 || !Number.isFinite(Date.parse(event.created_at))) return NextResponse.json({ error: 'Invalid email event' }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc('apply_invoice_email_event', { p_id: eventId, p_message: event.data.email_id, p_type: event.type, p_created: event.created_at, p_recipient: event.data.to[0] });
  if (error) return NextResponse.json({ error: 'Email event requires retry or finance reconciliation.' }, { status: 503 });
  return NextResponse.json(data ?? { received: true });
}
