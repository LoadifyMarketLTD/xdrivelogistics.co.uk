import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const payloadSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional().default(''),
  pickupLocation: z.string().trim().min(2).max(250),
  deliveryLocation: z.string().trim().min(2).max(250),
  cargoType: z.enum(['pallets', 'parcels', 'furniture', 'documents', 'other']),
  quantity: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
});

const CONFIGURED_DEFAULT_COMPANY_ID =
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() ||
  '';

const resolveDefaultCompanyId = async (): Promise<string | null> => {
  if (CONFIGURED_DEFAULT_COMPANY_ID) return CONFIGURED_DEFAULT_COMPANY_ID;
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[quote-request] failed to resolve default company', { code: error.code });
    return null;
  }

  if (data?.[0]?.id) return data[0].id;

  const { data: created, error: createError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: 'Public Quote Intake',
      email: 'intake@xdrivelogistics.co.uk',
    })
    .select('id')
    .single();

  if (createError) {
    console.error('[quote-request] failed to bootstrap public intake company', { code: createError.code });
    return null;
  }

  return created.id;
};

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

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Quote intake is unavailable. Missing Supabase admin configuration.' },
      { status: 503 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid quote request payload.' }, { status: 400 });
  }

  const data = parsed.data;
  const defaultCompanyId = await resolveDefaultCompanyId();
  if (!defaultCompanyId) {
    return NextResponse.json(
      { error: 'Quote intake is unavailable. Missing default company configuration.' },
      { status: 503 }
    );
  }

  const { error } = await supabaseAdmin.from('quotes').insert({
    company_id: defaultCompanyId,
    customer_name: data.fullName,
    customer_email: data.email,
    customer_phone: data.phone || null,
    pickup_location: data.pickupLocation,
    delivery_location: data.deliveryLocation,
    cargo_type: CARGO_TO_DB[data.cargoType],
    status: 'draft',
    currency: 'GBP',
    amount: null,
    notes: [
      data.quantity ? `Qty: ${data.quantity}` : null,
      data.notes || null,
    ].filter(Boolean).join(' | ') || null,
  });

  if (error) {
    console.error('[quote-request] insert failed', { code: error.code });
    return NextResponse.json({ error: 'Failed to submit quote request. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
