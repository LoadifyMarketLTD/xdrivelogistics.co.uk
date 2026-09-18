import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../_lib/requireCompanyAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const createQuoteSchema = z.object({
  companyId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(500),
  customerEmail: z.string().trim().max(500).optional().nullable(),
  customerPhone: z.string().trim().max(100).optional().nullable(),
  pickupLocation: z.string().trim().max(1000).optional().nullable(),
  deliveryLocation: z.string().trim().max(1000).optional().nullable(),
  vehicleType: z.string().trim().max(100).optional().nullable(),
  cargoType: z.string().trim().max(100).optional().nullable(),
  amount: z.number().nonnegative().finite().optional().nullable(),
  currency: z.string().trim().min(3).max(3).default('GBP'),
});

const QUOTE_COLUMNS = 'id, company_id, created_by, customer_name, customer_email, customer_phone, pickup_location, delivery_location, vehicle_type, cargo_type, amount, currency, status, created_at, updated_at, quote_sent_at, accepted_at, converted_at, converted_job_id, execution_mode';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Quote service is unavailable.' });
  }

  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .eq('company_id', admin.companyId)
    .order('created_at', { ascending: false });

  if (error) return json(500, { error: 'Quotes could not be loaded.' });
  return json(200, { quotes: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Quote service is unavailable.' });
  }

  const parsed = createQuoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Quote details are invalid.' });

  const admin = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .insert({
      company_id: admin.companyId,
      created_by: admin.userId,
      customer_name: parsed.data.customerName,
      customer_email: parsed.data.customerEmail || null,
      customer_phone: parsed.data.customerPhone || null,
      pickup_location: parsed.data.pickupLocation || null,
      delivery_location: parsed.data.deliveryLocation || null,
      vehicle_type: parsed.data.vehicleType || null,
      cargo_type: parsed.data.cargoType || null,
      amount: parsed.data.amount ?? null,
      currency: parsed.data.currency.toUpperCase(),
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .select(QUOTE_COLUMNS)
    .single();

  if (error || !data) return json(500, { error: 'Quote could not be created.' });
  return json(201, { quote: data });
}
