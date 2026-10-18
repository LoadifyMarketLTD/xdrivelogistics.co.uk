import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { submitInvoice } from '../../../../lib/server/invoiceDelivery';
import { getCanonicalSiteOrigin } from '../../../../lib/siteUrl';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  const { data: pending, error } = await supabaseAdmin.from('invoice_delivery_outbox').select('invoice_id').is('completed_at', null).lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  const results = [];
  for (const item of pending ?? []) {
    const { data: invoice } = await supabaseAdmin.from('invoices').select('company_id,created_by').eq('id', item.invoice_id).single();
    if (!invoice?.created_by) continue;
    const response = await submitInvoice(new NextRequest(`${getCanonicalSiteOrigin()}/api/internal/invoice-deliveries`, { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: item.invoice_id }) }, { userId: invoice.created_by, companyId: invoice.company_id });
    results.push({ invoiceId: item.invoice_id, status: response.status });
  }
  return NextResponse.json({ results });
}
