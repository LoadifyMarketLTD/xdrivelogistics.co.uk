import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { getCommercialLegalReadiness, commercialLegalReadinessPayload } from '../../../_lib/commercialLegalReadiness';

type Params = { params: Promise<{ id: string }> };
const bodySchema = z.object({ action: z.enum(['accept', 'decline']), reason: z.string().trim().max(1000).optional() });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Service not available.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error } = await validator.auth.getUser(token);
  if (error || !user) return json(401, { error: 'Unauthorized.' });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: 'Invalid booking-offer response.' });
  const { id } = await params;

  if (parsed.data.action === 'accept') {
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('job_booking_offers')
      .select('id, buyer_company_id, carrier_company_id, status')
      .eq('id', id)
      .maybeSingle();
    if (offerError) return json(500, { error: 'Booking offer could not be verified.' });
    if (!offer) return json(404, { error: 'Booking offer not found.' });
    if (offer.status !== 'pending') return json(409, { error: 'This booking offer is no longer pending.' });

    let buyerLegalReadiness;
    let carrierLegalReadiness;
    try {
      [buyerLegalReadiness, carrierLegalReadiness] = await Promise.all([
        getCommercialLegalReadiness(supabaseAdmin, offer.buyer_company_id),
        getCommercialLegalReadiness(supabaseAdmin, offer.carrier_company_id),
      ]);
    } catch {
      return json(503, { error: 'Current legal acceptance could not be verified. Please try again.' });
    }
    if (!buyerLegalReadiness.infrastructureAvailable || !carrierLegalReadiness.infrastructureAvailable) {
      return json(503, { error: 'Legal agreement evidence is temporarily unavailable.' });
    }
    if (!buyerLegalReadiness.ready) {
      return json(409, commercialLegalReadinessPayload(
        'The transport buyer must re-accept the current XDrive legal agreements before this booking can be accepted.',
        buyerLegalReadiness,
      ));
    }
    if (!carrierLegalReadiness.ready) {
      return json(409, commercialLegalReadinessPayload(
        'Re-accept the current XDrive legal agreements before accepting this booking.',
        carrierLegalReadiness,
      ));
    }

  }

  const rpc = parsed.data.action === 'accept' ? 'accept_job_booking_offer_atomic' : 'decline_job_booking_offer_atomic';
  const args = parsed.data.action === 'accept'
    ? { p_offer_id: id, p_actor_user_id: user.id }
    : { p_offer_id: id, p_actor_user_id: user.id, p_reason: parsed.data.reason ?? null };
  const { data, error: rpcError } = await supabaseAdmin.rpc(rpc, args);
  if (rpcError) return json(rpcError.code === '42501' ? 403 : rpcError.code === '23514' ? 409 : 500, { error: rpcError.message });
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) return json(result?.http_status ?? 500, { error: result?.error_message ?? 'Booking response failed.', code: result?.error_code });
  return json(200, result as Record<string, unknown>);
}
