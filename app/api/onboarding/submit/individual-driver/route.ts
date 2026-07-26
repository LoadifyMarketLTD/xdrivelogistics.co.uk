import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { isLegacyIndividualDriverOnboardingApplication } from '../../../_lib/onboarding';
import { individualDriverPayloadSchema } from '../../_lib/schemas';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (applicationError) return json(500, { error: applicationError.message });
  if (!application) return json(404, { error: 'Onboarding application not found.' });
  if (application.account_type !== 'individual_driver') {
    return json(403, { error: 'Forbidden onboarding account type.' });
  }
  if (!isLegacyIndividualDriverOnboardingApplication(application.account_type, application.created_at)) {
    return json(403, {
      error: 'Individual-driver onboarding is a legacy flow restricted to historical accounts.',
    });
  }

  const parsed = individualDriverPayloadSchema.safeParse(application.payload ?? {});
  if (!parsed.success) {
    return json(400, {
      error: 'Onboarding payload is incomplete or invalid.',
      details: parsed.error.flatten(),
    });
  }

  const { error: submitError } = await supabaseAdmin.rpc('submit_individual_driver_onboarding', {
    p_application_id: application.id,
  });

  if (submitError) {
    return json(500, {
      error: 'Failed to submit individual driver onboarding.',
      details: submitError.message,
    });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('id', application.id)
    .single();

  if (updateError) return json(500, { error: updateError.message });

  return json(200, { application: updated, companyId: null });
}
