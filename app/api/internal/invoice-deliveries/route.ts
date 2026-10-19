import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { submitInvoice } from '../../../../lib/server/invoiceDelivery';
import { getCanonicalSiteOrigin } from '../../../../lib/siteUrl';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: workerSecretRow, error: workerSecretError } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'invoice_delivery_worker_secret')
    .maybeSingle();
  if (workerSecretError) return NextResponse.json({ error: 'Worker authentication unavailable' }, { status: 503 });

  const secret = typeof workerSecretRow?.value === 'string' ? workerSecretRow.value.trim() : '';
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: pending, error } = await supabaseAdmin.from('invoice_delivery_outbox').select('invoice_id').is('completed_at', null).lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  const results = [];
  for (const item of pending ?? []) {
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('company_id,created_by')
      .eq('id', item.invoice_id)
      .single();
    if (invoiceError) {
      return NextResponse.json({ error: 'Invoice delivery worker could not load the pending invoice.' }, { status: 503 });
    }
    if (!invoice?.created_by) {
      return NextResponse.json({ error: 'Pending invoice is missing its creator identity.' }, { status: 409 });
    }
    const response = await submitInvoice(new NextRequest(`${getCanonicalSiteOrigin()}/api/internal/invoice-deliveries`, { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: item.invoice_id }) }, { userId: invoice.created_by, companyId: invoice.company_id });
    results.push({ invoiceId: item.invoice_id, status: response.status });
  }
  return NextResponse.json({ results });
}
