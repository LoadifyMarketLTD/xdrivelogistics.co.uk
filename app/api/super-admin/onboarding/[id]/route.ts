import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { getStripeCommercialReadiness, stripeCommercialReadinessPayload } from '../../../_lib/stripeCommercialReadiness';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().trim().max(2000).optional(),
});

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized: invalid or expired token.' });
  }

  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid review action.' });
  }

  const { id } = await params;

  if (parsed.data.action === 'approve') {
    const { data: application, error: applicationError } = await supabaseAdmin
      .from('onboarding_applications')
      .select('id, user_id, company_id, account_type, status')
      .eq('id', id)
      .maybeSingle();
    if (applicationError) return respond(500, { error: 'Onboarding application could not be verified.' });
    if (!application) return respond(404, { error: 'Onboarding application not found.' });

    const commercialAccountTypes = new Set(['customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver']);
    if (commercialAccountTypes.has(String(application.account_type ?? ''))) {
      const { data: legalAcceptance, error: legalError } = await supabaseAdmin
        .from('registration_legal_acceptances')
        .select('id, signer_full_name, signature_method, signature_payload_hash, signed_pdf_path, signed_pdf_hash')
        .eq('user_id', application.user_id)
        .eq('onboarding_application_id', application.id)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (legalError) return respond(503, { error: 'Signed registration legal evidence could not be verified.' });
      const signedLegalReady = Boolean(
        legalAcceptance?.id
        && String(legalAcceptance.signer_full_name ?? '').trim()
        && legalAcceptance.signature_method === 'typed_name_explicit_acceptance'
        && /^[0-9a-f]{64}$/.test(String(legalAcceptance.signature_payload_hash ?? ''))
        && String(legalAcceptance.signed_pdf_path ?? '').trim()
        && /^[0-9a-f]{64}$/.test(String(legalAcceptance.signed_pdf_hash ?? ''))
      );
      if (!signedLegalReady) {
        return respond(409, {
          error: 'Approval is blocked until the applicant has read, accepted and electronically signed the required XDrive legal agreement package.',
          code: 'SIGNED_LEGAL_ACCEPTANCE_REQUIRED',
        });
      }

      if (!application.company_id) {
        return respond(409, {
          error: 'Approval is blocked until the onboarding application is bound to its commercial company.',
          code: 'COMMERCIAL_COMPANY_REQUIRED',
        });
      }

      let stripeReadiness;
      try {
        stripeReadiness = await getStripeCommercialReadiness(supabaseAdmin, application.company_id);
      } catch {
        return respond(503, { error: 'Stripe commercial readiness could not be verified. Please try again.' });
      }
      if (!stripeReadiness.infrastructureAvailable) {
        return respond(503, { error: 'Stripe commercial readiness is temporarily unavailable.' });
      }
      if (!stripeReadiness.ready) {
        return respond(409, stripeCommercialReadinessPayload(
          'Approval is blocked until the company completes and activates Stripe for commercial transport activity.'
        ));
      }
    }
  }

  const { data: reviewResult, error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
    p_application_id: id,
    p_actor_user_id: authData.user.id,
    p_action: parsed.data.action,
    p_notes: parsed.data.notes ?? null,
  });

  if (reviewError) {
    const statusCode = reviewError.code === 'P0002' ? 404 : reviewError.code === '23514' ? 409 : 500;
    return respond(statusCode, { error: reviewError.message });
  }

  const reviewed = Array.isArray(reviewResult) ? reviewResult[0] : reviewResult;
  return respond(200, {
    success: true,
    onboardingApplicationId: reviewed?.onboarding_application_id ?? id,
    status: reviewed?.status ?? null,
  });
}
