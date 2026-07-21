import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import type { OnboardingAccountType } from '../../../_lib/onboarding';
import { getOnboardingComplianceReadiness } from '../../../../../lib/server/onboardingCompliance';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function requireUploadedOnboardingDocuments(
  request: NextRequest,
  expectedAccountType: OnboardingAccountType,
): Promise<NextResponse | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized: invalid token.' });

  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, account_type')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (applicationError) return respond(500, { error: applicationError.message });
  if (!application) return respond(404, { error: 'Onboarding application not found.' });
  if (application.account_type !== expectedAccountType) {
    return respond(403, { error: 'Forbidden onboarding account type.' });
  }

  const { data: readiness, error: readinessError } = await getOnboardingComplianceReadiness(supabaseAdmin, {
    applicationId: application.id,
  });

  if (readinessError) return respond(500, { error: readinessError });
  if (!readiness) return respond(404, { error: 'Onboarding compliance record not found.' });
  if (!readiness.uploadReady) {
    return respond(409, {
      error: 'Upload all mandatory documents before submitting onboarding for review.',
      missingDocuments: readiness.missingDocuments,
      requiredDocuments: readiness.requiredDocuments,
    });
  }

  return null;
}
