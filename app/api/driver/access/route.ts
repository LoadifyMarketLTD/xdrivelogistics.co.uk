import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { getOnboardingComplianceReadiness } from '../../../../lib/server/onboardingCompliance';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized: invalid session.' });

  const [{ data: profile, error: profileError }, { data: driver, error: driverError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, is_driver, company_id, status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('id, company_id, status, app_access')
      .eq('user_id', authData.user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError) return respond(500, { error: profileError.message });
  if (driverError) return respond(500, { error: driverError.message });

  const role = String(profile?.role ?? '').trim().toLowerCase();
  const isDriverIdentity = profile?.is_driver === true || role === 'driver' || Boolean(driver?.id);

  if (!driver) {
    if (isDriverIdentity) {
      return respond(403, { allowed: false, error: 'An approved driver record is required.' });
    }
    return respond(200, { allowed: true, executionAllowed: false, businessWorkspaceOnly: true });
  }

  if (driver.app_access !== true) {
    return respond(403, { allowed: false, error: 'Driver application access is not approved.' });
  }
  if (String(driver.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(403, { allowed: false, error: 'Driver account is not active.' });
  }

  const { data: ownerDriverApplication, error: onboardingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status')
    .eq('user_id', authData.user.id)
    .eq('account_type', 'owner_driver')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (onboardingError) return respond(500, { error: onboardingError.message });

  if (ownerDriverApplication) {
    if (ownerDriverApplication.status !== 'approved') {
      return respond(403, { allowed: false, error: 'Owner-driver onboarding is not approved.' });
    }

    const { data: readiness, error: readinessError } = await getOnboardingComplianceReadiness(supabaseAdmin, {
      applicationId: ownerDriverApplication.id,
    });
    if (readinessError) return respond(500, { error: readinessError });
    if (!readiness?.approvalReady) {
      return respond(403, {
        allowed: false,
        error: 'Mandatory driver compliance is missing, unverified, or expired.',
        missingDocuments: readiness?.missingDocuments ?? [],
        unverifiedDocuments: readiness?.unverifiedDocuments ?? [],
        expiredDocuments: readiness?.expiredDocuments ?? [],
      });
    }
  }

  return respond(200, {
    allowed: true,
    executionAllowed: true,
    businessWorkspaceOnly: false,
    driverId: driver.id,
    companyId: driver.company_id,
  });
}
