import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../_lib/requireCompanyAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const patchSchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'withdrawn']),
});

const allowedTransitions: Record<string, Set<string>> = {
  draft: new Set(['sent', 'accepted', 'declined', 'withdrawn']),
  sent: new Set(['draft', 'accepted', 'declined', 'withdrawn']),
  accepted: new Set(['withdrawn']),
  declined: new Set(),
  withdrawn: new Set(['draft']),
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Quote service is unavailable.' });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Quote status request is invalid.' });

  const admin = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) return json(400, { error: 'Quote id is required.' });

  const { data: quote, error: lookupError } = await supabaseAdmin
    .from('quotes')
    .select('id, company_id, status, converted_job_id')
    .eq('id', quoteId)
    .eq('company_id', admin.companyId)
    .maybeSingle();
  if (lookupError) return json(500, { error: 'Quote could not be verified.' });
  if (!quote) return json(404, { error: 'Quote not found.' });
  if (quote.converted_job_id || String(quote.status).toLowerCase() === 'converted') {
    return json(409, { error: 'Converted quotes cannot be changed.' });
  }

  const currentStatus = String(quote.status ?? 'draft').toLowerCase();
  if (currentStatus === parsed.data.status) return json(200, { quote });
  if (!allowedTransitions[currentStatus]?.has(parsed.data.status)) {
    return json(409, { error: `Quote cannot move from ${currentStatus} to ${parsed.data.status}.` });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: parsed.data.status, updated_at: now };
  if (parsed.data.status === 'sent') update.quote_sent_at = now;
  if (parsed.data.status === 'accepted') update.accepted_at = now;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('quotes')
    .update(update)
    .eq('id', quoteId)
    .eq('company_id', admin.companyId)
    .select('id, company_id, status, updated_at, quote_sent_at, accepted_at, converted_job_id')
    .single();

  if (updateError || !updated) return json(500, { error: 'Quote status could not be updated.' });
  return json(200, { quote: updated });
}
