import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return { userId: authData.user.id, driverId: driverRow.id as string, companyId: driverRow.company_id as string };
}

// POST /api/driver/finance/invoices/[id]/submit
// Transitions invoice from Draft → Sent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  // Fetch and guard invoice
  const { data: invoice, error: fetchError } = await supabaseAdmin
    .from('invoices')
    .select('id, status, company_id')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();

  if (fetchError) return respond(500, { error: fetchError.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  const currentStatus = toCanonicalInvoiceStatus(invoice.status);

  if (currentStatus !== 'Draft') {
    return respond(409, {
      error: `Invoice cannot be sent from status "${currentStatus}". Only Draft invoices can be sent.`,
    });
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('invoices')
    .update({
      status: toLegacyInvoiceStatusForDb('Sent'),
      submitted_at: now,
      submitted_by: driver.userId,
      updated_at: now,
    })
    .eq('id', id)
    .select('id, status, submitted_at')
    .single();

  if (updateError) return respond(500, { error: updateError.message });

  return respond(200, {
    invoice: updated
      ? {
          ...updated,
          status: toCanonicalInvoiceStatus((updated as { status?: string }).status),
        }
      : updated,
  });
}
