import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export type ComplianceDriverContext = {
  userId: string;
  driverId: string;
  companyId: string;
  driverType: 'owner_driver' | 'company_driver';
  appAccess: boolean;
  canCommercialBid: boolean;
};

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const activeStatus = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'active' || normalized === 'approved';
};

export const isComplianceDriverContext = (
  value: ComplianceDriverContext | NextResponse,
): value is ComplianceDriverContext => !(value instanceof NextResponse);

/**
 * Resolve an authenticated Driver for compliance remediation without requiring
 * app_access=true. This is deliberately narrower than requireWebDriver():
 * the Driver, profile, company and membership must all already be active and
 * company-linked, but missing compliance is allowed so the user can repair it.
 */
export async function resolveComplianceDriver(
  request: NextRequest,
): Promise<ComplianceDriverContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Compliance remediation is temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — missing bearer token.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized — invalid or expired session.' });
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id,user_id,company_id,status,is_active,app_access,driver_type,can_commercial_bid')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (driverError) return json(500, { error: 'Driver compliance profile could not be loaded.' });
  if (!driver || !driver.company_id || String(driver.status ?? '').toLowerCase() !== 'active' || driver.is_active !== true) {
    return json(403, { error: 'An active company-linked Driver profile is required.' });
  }

  const driverType = String(driver.driver_type ?? '').trim().toLowerCase();
  if (driverType !== 'owner_driver' && driverType !== 'company_driver') {
    return json(403, { error: 'This Driver account is not eligible for this remediation flow.' });
  }

  const [{ data: profile, error: profileError }, { data: company, error: companyError }, { data: membership, error: membershipError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('companies')
      .select('status')
      .eq('id', driver.company_id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('status')
      .eq('user_id', authData.user.id)
      .eq('company_id', driver.company_id)
      .maybeSingle(),
  ]);

  if (profileError || companyError || membershipError) {
    return json(500, { error: 'Compliance access could not be verified.' });
  }
  if (!profile || !activeStatus(profile.status)) {
    return json(403, { error: 'Driver profile is not active.' });
  }
  if (!company || !activeStatus(company.status)) {
    return json(403, { error: 'Driver company is not active.' });
  }
  if (!membership || String(membership.status ?? '').trim().toLowerCase() !== 'active') {
    return json(403, { error: 'Active company membership is required.' });
  }

  return {
    userId: authData.user.id,
    driverId: String(driver.id),
    companyId: String(driver.company_id),
    driverType: driverType as ComplianceDriverContext['driverType'],
    appAccess: driver.app_access === true,
    canCommercialBid: driver.can_commercial_bid === true,
  };
}
