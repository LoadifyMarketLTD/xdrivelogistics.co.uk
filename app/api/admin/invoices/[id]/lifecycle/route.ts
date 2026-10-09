import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const schema = z.object({
  action: z.enum(['void', 'credit_note']),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid lifecycle action payload.' });

  const { id } = await params;
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, company_id, status, commercial_agreement_id, buyer_company_id, supplier_company_id, job_id')
    .eq('id', id)
    .maybeSingle();
  if (invoiceError) return respond(500, { error: invoiceError.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', invoice.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });

  const role = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin', 'dispatcher', 'finance'].includes(role)) {
    return respond(403, { error: 'Finance workspace role is required to manage invoice lifecycle.' });
  }

  const currentStatus = toCanonicalInvoiceStatus(invoice.status);
  if (parsed.data.action === 'void') {
    if (currentStatus === 'Paid') {
      return respond(409, { error: 'Paid invoices cannot be voided. Create a credit note dispute instead.' });
    }
    if (currentStatus === 'Cancelled') {
      return respond(200, { replayed: true, invoice: { id: invoice.id, status: currentStatus } });
    }

    const reason = parsed.data.reason?.trim() || 'Invoice voided by finance workspace.';
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        status: toLegacyInvoiceStatusForDb('Cancelled'),
        updated_at: new Date().toISOString(),
        delivery_error: reason,
      })
      .eq('id', invoice.id)
      .eq('company_id', invoice.company_id)
      .select('id, status')
      .single();
    if (updateError) return respond(500, { error: updateError.message });

    return respond(200, {
      invoice: {
        id: updated.id,
        status: toCanonicalInvoiceStatus(updated.status),
      },
      replayed: false,
    });
  }

  return respond(409, {
    error: 'Credit notes are financial adjustment documents, not disputes. Create the credit note from the invoice adjustment action.',
    code: 'USE_INVOICE_ADJUSTMENT',
  });
}
