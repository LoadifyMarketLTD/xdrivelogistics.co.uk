import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';

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

// GET /api/driver/finance/invoices/[id]/disputes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (!inv) return respond(404, { error: 'Invoice not found.' });

  const { data, error } = await supabaseAdmin
    .from('invoice_disputes')
    .select('id, reason, details, status, resolution_note, created_at, resolved_at')
    .eq('invoice_id', id)
    .order('created_at', { ascending: false });

  if (error) return respond(500, { error: error.message });
  return respond(200, { disputes: data ?? [] });
}

// POST /api/driver/finance/invoices/[id]/disputes
// Body: { reason, details? }
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

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('id, status')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (!inv) return respond(404, { error: 'Invoice not found.' });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { reason, details } = body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return respond(400, { error: 'reason is required.' });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoice_disputes')
    .insert({
      invoice_id: id,
      company_id: driver.companyId,
      created_by: driver.userId,
      reason: (reason as string).trim(),
      details: typeof details === 'string' ? details : null,
      status: 'open',
    })
    .select('id, reason, details, status, created_at')
    .single();

  if (insertError) return respond(500, { error: insertError.message });

  // Update invoice status to Disputed
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('invoices')
    .update({ status: 'Disputed', disputed_at: now, updated_at: now })
    .eq('id', id);

  return respond(201, { dispute: inserted });
}
