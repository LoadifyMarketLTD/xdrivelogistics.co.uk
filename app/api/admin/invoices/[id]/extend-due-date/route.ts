import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const bodySchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Finance service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: 'A specific reason of at least 10 characters is required for the special +15 day extension.',
    });
  }

  const { id: invoiceId } = await params;
  const { data, error } = await supabaseAdmin.rpc('extend_invoice_due_date_special', {
    p_invoice_id: invoiceId,
    p_actor_user_id: authData.user.id,
    p_reason: parsed.data.reason,
  });

  if (error) {
    const status = error.code === '42501'
      ? 403
      : error.code === 'P0002'
        ? 404
        : error.code === '22023'
          ? 400
          : error.code === '23514'
            ? 409
            : 500;
    return respond(status, { error: error.message });
  }

  const invoice = Array.isArray(data) ? data[0] : data;
  return respond(200, {
    success: true,
    invoice,
    extensionDays: 15,
  });
}
