import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { isLegacyIndividualDriverOnboardingApplication } from '../../../_lib/onboarding';
import { companyDriverPayloadSchema } from '../../_lib/schemas';
import {
  isCompanyDriverOnboardingApplication,
  normalizeCanonicalOnboardingAccountType,
} from '../../../../../lib/onboardingContract';

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

  const { data: applicationRows, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(2);

  if (applicationError) return json(500, { error: applicationError.message });
  if ((applicationRows ?? []).length > 1) {
    return json(409, {
      error: 'Multiple onboarding applications were found for this user. Platform Owner review is required before submission.',
      code: 'onboarding_application_integrity_violation',
    });
  }
  const application = applicationRows?.[0] ?? null;
  if (!application) return json(404, { error: 'Onboarding application not found.' });

  const canonicalAccountType = normalizeCanonicalOnboardingAccountType(application.account_type);
  if (canonicalAccountType !== 'company_driver') {
    return json(403, { error: 'Forbidden onboarding account type.' });
  }

  const companyDriverInvite = isCompanyDriverOnboardingApplication(application as Record<string, unknown>);
  const historicalLegacyAccount = isLegacyIndividualDriverOnboardingApplication(
    application.account_type,
    application.created_at,
  );
  if (!companyDriverInvite && !historicalLegacyAccount) {
    return json(403, {
      error: 'Company Driver onboarding is invitation-only and must be linked to one Fleet Operator.',
    });
  }

  const parsed = companyDriverPayloadSchema.safeParse(application.payload ?? {});
  if (!parsed.success) {
    return json(400, {
      error: 'Onboarding payload is incomplete or invalid.',
      details: parsed.error.flatten(),
    });
  }

  // RPC name is retained for database compatibility; the canonical account
  // identity handled by the application is Company Driver.
  const { error: submitError } = await supabaseAdmin.rpc('submit_individual_driver_onboarding', {
    p_application_id: application.id,
  });

  if (submitError) {
    return json(500, {
      error: 'Failed to submit Company Driver onboarding.',
      details: submitError.message,
    });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('id', application.id)
    .single();

  if (updateError) return json(500, { error: updateError.message });

  return json(200, { application: updated, companyId: updated.company_id ?? null });
}
