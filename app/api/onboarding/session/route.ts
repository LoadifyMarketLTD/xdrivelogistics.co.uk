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

  return json(200, {
    application: {
      ...app,
      account_type: accountType,
    },
    routeSegment,
    resumePath: `/onboarding/${routeSegment}/resume`,
  });
}

export async function PATCH() {
  return json(410, { error: 'Use account-specific onboarding session endpoints.' });
}
