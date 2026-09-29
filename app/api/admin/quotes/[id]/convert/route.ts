import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../../_lib/requireCompanyAdmin';
import { calculateJobRouteMetrics } from '../../../../_lib/jobRouteMetrics';
import { getStripeCommercialReadiness, stripeCommercialReadinessPayload } from '../../../../_lib/stripeCommercialReadiness';
import { getCommercialLegalReadiness, commercialLegalReadinessPayload } from '../../../../_lib/commercialLegalReadiness';
import { getTransportBuyerRiskSnapshot, logTransportBuyerRiskBlockedEvent, transportBuyerRiskBlockedPayload } from '../../../../_lib/transportBuyerRisk';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const payloadSchema = z.object({ companyId: z.string().uuid() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Quote conversion service is unavailable.' });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Company context is required.' });

  const admin = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await context.params;
  const quoteId = id?.trim();
  if (!quoteId) return json(400, { error: 'Quote id is required.' });

  const { data: quote, error: lookupError } = await supabaseAdmin
    .from('quotes')
    .select('id, company_id, status, converted_job_id, customer_name, customer_email, customer_phone, pickup_location, delivery_location, vehicle_type, cargo_type')
    .eq('id', quoteId)
    .eq('company_id', admin.companyId)
    .maybeSingle();
  if (lookupError) return json(500, { error: 'Quote could not be verified.' });
  if (!quote) return json(404, { error: 'Quote not found.' });

  if (quote.converted_job_id) {
    return json(200, { ok: true, jobId: quote.converted_job_id, alreadyConverted: true });
  }
  if (String(quote.status ?? '').toLowerCase() !== 'accepted') {
    return json(409, { error: 'Only accepted quotes can be converted to jobs.' });
  }

  let legalReadiness;
  try {
    legalReadiness = await getCommercialLegalReadiness(supabaseAdmin, admin.companyId);
  } catch {
    return json(503, { error: 'Current legal acceptance could not be verified. Please try again.' });
  }
  if (!legalReadiness.infrastructureAvailable) {
    return json(503, { error: 'Legal agreement evidence is temporarily unavailable.' });
  }
  if (!legalReadiness.ready) {
    return json(409, commercialLegalReadinessPayload(
      'Review and re-accept the current XDrive legal agreements before converting this quote into transport work.',
      legalReadiness,
      '/admin/settings/legal-agreements',
    ));
  }

  let stripeReadiness;
  try {
    stripeReadiness = await getStripeCommercialReadiness(supabaseAdmin, admin.companyId);
  } catch {
    return json(503, { error: 'Stripe commercial readiness could not be verified. Please try again.' });
  }
  if (!stripeReadiness.infrastructureAvailable) {
    return json(503, { error: 'Stripe commercial readiness is temporarily unavailable.' });
  }
  if (!stripeReadiness.ready) {
    return json(409, stripeCommercialReadinessPayload(
      'Complete and activate your company Stripe account before converting this quote into transport work.'
    ));
  }

  try {
    const risk = await getTransportBuyerRiskSnapshot(supabaseAdmin, admin.companyId, 0);
    if (!risk.infrastructureAvailable || !risk.snapshot) {
      return json(503, { error: 'Transport buyer risk controls are temporarily unavailable.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' });
    }
    if (!risk.snapshot.allowed) {
      await logTransportBuyerRiskBlockedEvent(supabaseAdmin, risk.snapshot, 'publish_blocked', admin.userId, {
        operation: 'admin_quote_convert',
        quote_id: quoteId,
      });
      return json(409, transportBuyerRiskBlockedPayload(risk.snapshot));
    }
  } catch {
    return json(503, { error: 'Transport buyer exposure could not be verified. Please try again.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' });
  }

  const pickupPostcode = String(quote.pickup_location ?? '').trim().toUpperCase();
  const deliveryPostcode = String(quote.delivery_location ?? '').trim().toUpperCase();
  const routeMetrics = pickupPostcode && deliveryPostcode
    ? await calculateJobRouteMetrics([pickupPostcode, deliveryPostcode])
    : null;

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      company_id: admin.companyId,
      created_by: admin.userId,
      status: 'posted',
      client_name: quote.customer_name,
      client_email: quote.customer_email ?? null,
      client_phone: quote.customer_phone ?? null,
      load_details: quote.customer_name,
      pickup_location: quote.pickup_location ?? null,
      pickup_postcode: pickupPostcode || null,
      pickup_lat: routeMetrics?.pickupLat ?? null,
      pickup_lng: routeMetrics?.pickupLng ?? null,
      delivery_location: quote.delivery_location ?? null,
      delivery_postcode: deliveryPostcode || null,
      delivery_lat: routeMetrics?.deliveryLat ?? null,
      delivery_lng: routeMetrics?.deliveryLng ?? null,
      job_distance_miles: routeMetrics?.distanceMiles ?? null,
      job_distance_minutes: routeMetrics?.durationMinutes ?? null,
      vehicle_type: quote.vehicle_type ?? null,
      cargo_type: quote.cargo_type ?? null,
    })
    .select('id')
    .single();

  if (jobError || !job) return json(500, { error: 'Job could not be created from this quote.' });

  const now = new Date().toISOString();
  const { data: converted, error: convertError } = await supabaseAdmin
    .from('quotes')
    .update({ status: 'converted', converted_at: now, converted_job_id: job.id, updated_at: now })
    .eq('id', quoteId)
    .eq('company_id', admin.companyId)
    .eq('status', 'accepted')
    .is('converted_job_id', null)
    .select('id, converted_job_id')
    .maybeSingle();

  if (convertError || !converted) {
    const { error: compensationError } = await supabaseAdmin.from('jobs').delete().eq('id', job.id);
    if (compensationError) {
      console.error('[admin/quotes/convert] compensation failed', { quoteId, jobId: job.id, code: compensationError.code });
      return json(500, { error: 'Quote conversion failed and requires administrator review.' });
    }
    return json(409, { error: 'Quote changed while conversion was in progress. No job was retained.' });
  }

  return json(201, { ok: true, jobId: job.id, alreadyConverted: false });
}
