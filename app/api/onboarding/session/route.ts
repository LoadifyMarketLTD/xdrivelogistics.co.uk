import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import {
  ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE,
  normalizeOnboardingAccountType,
} from '../../_lib/onboarding';
import { getOnboardingContract } from '../../../../lib/onboardingContract';
import { assessOnboardingRecovery } from '../../../../lib/onboardingProgress';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const getAuthUser = async (request: NextRequest) => {
  const token = getBearerToken(request);
  if (!token || !supabaseAdmin) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return json(401, { error: 'Unauthorized.' });
  }

  const { data: app, error } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!app) return json(404, { error: 'Onboarding application not found.' });

  const accountType = normalizeOnboardingAccountType(app.account_type);
  if (!accountType) {
    return json(409, {
      error: 'The saved onboarding application has an unsupported account type. Contact XDrive support before continuing.',
      code: 'unsupported_saved_account_type',
    });
  }

  const routeSegment = ONBOARDING_ROUTE_SEGMENT_BY_ACCOUNT_TYPE[accountType];
  const contract = getOnboardingContract(accountType);
  const payload = app.payload && typeof app.payload === 'object' && !Array.isArray(app.payload)
    ? { ...(app.payload as Record<string, unknown>) }
    : {};

  if (contract?.documents.length) {
    const identityTypes = contract.documents.filter((doc) => doc.family === 'identity').map((doc) => doc.type);
    const companyTypes = contract.documents.filter((doc) => doc.family === 'company').map((doc) => doc.type);

    if (identityTypes.length > 0) {
      const { data: identityDocs, error: identityError } = await supabaseAdmin
        .from('driver_identity_documents')
        .select('doc_type, file_path, upload_status, verification_status')
        .eq('onboarding_application_id', app.id)
        .in('doc_type', identityTypes);
      if (identityError) return json(500, { error: identityError.message });
      for (const doc of identityDocs ?? []) {
        if (doc.file_path && doc.upload_status === 'uploaded') payload[`doc_${doc.doc_type}`] = doc.file_path;
      }
    }

    if (companyTypes.length > 0) {
      const { data: companyDocs, error: companyError } = await supabaseAdmin
        .from('company_documents')
        .select('doc_type, file_path, status')
        .eq('onboarding_application_id', app.id)
        .in('doc_type', companyTypes);
      if (companyError) return json(500, { error: companyError.message });
      for (const doc of companyDocs ?? []) {
        if (doc.file_path && doc.status !== 'rejected') payload[`doc_${doc.doc_type}`] = doc.file_path;
      }
    }
  }

  const recovery = assessOnboardingRecovery(accountType, payload);

  return json(200, {
    application: {
      ...app,
      account_type: accountType,
      payload,
      completion_percentage: app.status === 'approved' ? 100 : recovery.progress,
    },
    recovery,
    routeSegment,
    resumePath: `/onboarding/${routeSegment}/resume`,
  });
}

export async function PATCH() {
  return json(410, { error: 'Use account-specific onboarding session endpoints.' });
}
