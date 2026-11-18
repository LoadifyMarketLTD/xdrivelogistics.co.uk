import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const payloadSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional().default(''),
  pickupLocation: z.string().trim().min(2).max(250),
  deliveryLocation: z.string().trim().min(2).max(250),
  vehicleType: z.string().trim().max(120).optional().default(''),
  cargoType: z.enum(['pallets', 'parcels', 'furniture', 'documents', 'other']),
  quantity: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
});

const CONFIGURED_INTAKE_COMPANY_ID =
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

const CARGO_TO_DB: Record<
  z.infer<typeof payloadSchema>['cargoType'],
  'pallets' | 'packages' | 'furniture' | 'documents' | 'other'
> = {
  pallets: 'pallets',
  parcels: 'packages',
  furniture: 'furniture',
  documents: 'documents',
  other: 'other',
};

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || 'unknown';
  return forwarded.trim().slice(0, 128);
}

function rateKey(scope: 'ip' | 'email', value: string) {
  return `${scope}:${createHash('sha256').update(value.trim().toLowerCase()).digest('hex')}`;
}

async function consumeRateLimit(key: string, limit: number) {
  const { data, error } = await supabaseAdmin!.rpc('consume_public_quote_rate_limit', {
    p_rate_key: key,
    p_limit: limit,
    p_window_seconds: 3600,
  });
  if (error) throw error;
  return data === true;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Quote intake is unavailable. Missing Supabase admin configuration.' },
      { status: 503 }
    );
  }

  if (!CONFIGURED_INTAKE_COMPANY_ID) {
    return NextResponse.json(
      { error: 'Quote intake is unavailable. Missing intake company configuration.' },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid quote request payload.' }, { status: 400 });
  }

  const data = parsed.data;
  let allowedByIp = false;
  let allowedByEmail = false;
  try {
    [allowedByIp, allowedByEmail] = await Promise.all([
      consumeRateLimit(rateKey('ip', clientIp(request)), 10),
      consumeRateLimit(rateKey('email', data.email), 5),
    ]);
  } catch (rateLimitError) {
    console.error('[quote-request] rate limit check failed', rateLimitError);
    return NextResponse.json({ error: 'Quote intake is temporarily unavailable. Please try again shortly.' }, { status: 503 });
  }
  if (!allowedByIp || !allowedByEmail) {
    return NextResponse.json(
      { error: 'Too many quote requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  const { data: created, error } = await supabaseAdmin
    .from('quotes')
    .insert({
      company_id: CONFIGURED_INTAKE_COMPANY_ID,
      customer_name: data.fullName,
      customer_email: data.email,
      customer_phone: data.phone || null,
      pickup_location: data.pickupLocation,
      delivery_location: data.deliveryLocation,
      vehicle_type: data.vehicleType || null,
      cargo_type: CARGO_TO_DB[data.cargoType],
      status: 'draft',
      currency: 'GBP',
      amount: null,
      notes: [
        data.quantity ? `Qty: ${data.quantity}` : null,
        data.notes || null,
      ].filter(Boolean).join(' | ') || null,
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    console.error('[quote-request] insert failed', { code: error?.code });
    return NextResponse.json({ error: 'Failed to submit quote request. Please try again.' }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, id: created.id, reference: created.id },
    { status: 201 }
  );
}
