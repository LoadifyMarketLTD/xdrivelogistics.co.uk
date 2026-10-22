import { NextRequest, NextResponse } from 'next/server';

import { membershipHasCapability, resolveMembershipRole } from '../../../../../../lib/membershipRole';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { id } = await params;
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, status, payment_status, buyer_company_id, supplier_company_id, approved_at, approved_by, submitted_at')
    .eq('id', id)
    .maybeSingle();

  if (invoiceError) return json(500, { error: invoiceError.message });
  if (!invoice) return json(404, { error: 'Invoice not found.' });
  if (!invoice.buyer_company_id) {
    return json(409, { error: 'Invoice is not bound to a buyer company.' });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('company_id', invoice.buyer_company_id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return json(500, { error: membershipError.message });
  const role = resolveMembershipRole(membership?.role_in_company ?? null);
  if (!membership || !role || !membershipHasCapability(role, 'payments.manage')) {
    return json(403, { error: 'Payments authority is required for this buyer company.' });
  }

  if (String(invoice.payment_status ?? '').toLowerCase() === 'paid') {
    return json(409, { error: 'Invoice is already paid.' });
  }

  const status = String(invoice.status ?? '').trim().toLowerCase();
  if (!['sent', 'submitted', 'approved', 'overdue'].includes(status)) {
    return json(409, { error: 'Only an issued invoice can be approved for payment.' });
  }

  if (invoice.approved_at) {
    return json(200, {
      replayed: true,
      invoice: {
        id: invoice.id,
        status: invoice.status,
        approvedAt: invoice.approved_at,
        approvedBy: invoice.approved_by,
      },
    });
  }

  const approvedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('invoices')
    .update({
      status: 'Approved',
      approved_at: approvedAt,
      approved_by: authData.user.id,
      updated_at: approvedAt,
    })
    .eq('id', invoice.id)
    .eq('buyer_company_id', invoice.buyer_company_id)
    .is('approved_at', null)
    .eq('status', invoice.status)
    .select('id, status, approved_at, approved_by')
    .maybeSingle();

  if (updateError) return json(500, { error: updateError.message });
  if (!updated) {
    const { data: replay } = await supabaseAdmin
      .from('invoices')
      .select('id, status, approved_at, approved_by')
      .eq('id', invoice.id)
      .maybeSingle();

    if (replay?.approved_at) {
      return json(200, {
        replayed: true,
        invoice: {
          id: replay.id,
          status: replay.status,
          approvedAt: replay.approved_at,
          approvedBy: replay.approved_by,
        },
      });
    }
    return json(409, { error: 'Invoice approval state changed. Refresh and retry.' });
  }

  return json(200, {
    replayed: false,
    invoice: {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approved_at,
      approvedBy: updated.approved_by,
    },
  });
}
