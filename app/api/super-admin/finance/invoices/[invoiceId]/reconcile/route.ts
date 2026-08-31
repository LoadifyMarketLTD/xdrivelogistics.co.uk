import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const MIGRATION_UNAVAILABLE_CODES = new Set(['PGRST202', '42883']);

const patchSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: parsed.error.issues[0]?.message ?? 'Invalid invoice reconciliation payload.',
      details: parsed.error.flatten(),
    });
  }

  const { invoiceId } = await params;
  const { data, error } = await supabaseAdmin.rpc('owner_reconcile_invoice_payment_status', {
    p_actor_user_id: owner.id,
    p_invoice_id: invoiceId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    if (MIGRATION_UNAVAILABLE_CODES.has(error.code ?? '') || error.message.includes('owner_reconcile_invoice_payment_status')) {
      return respond(503, {
        error: 'Platform finance reconciliation schema is not applied in this environment.',
        migrationRequired: '20260831015000_platform_finance_reconciliation.sql',
      });
    }
    if (error.code === 'P0002') return respond(404, { error: error.message });
    if (error.code === '23514' || error.code === '23502') return respond(409, { error: error.message });
    if (error.code === '42501') return respond(403, { error: error.message });
    return respond(500, { error: error.message });
  }

  return respond(200, {
    success: true,
    reconciliation: Array.isArray(data) ? data[0] ?? null : data,
  });
}
