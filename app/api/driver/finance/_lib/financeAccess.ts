import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

export type DriverFinanceContext = {
  userId: string;
  driverId: string;
  companyId: string;
  role: 'owner' | 'admin';
};

export type DriverFinanceAccessResult =
  | { ok: true; context: DriverFinanceContext }
  | { ok: false; response: NextResponse };

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function requireDriverFinanceAccess(
  request: NextRequest,
): Promise<DriverFinanceAccessResult> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return {
      ok: false,
      response: json(503, { error: 'Finance access is temporarily unavailable.' }),
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, response: json(401, { error: 'Unauthorized.' }) };
  }

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) {
    return { ok: false, response: json(401, { error: 'Unauthorized.' }) };
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id,company_id,status,app_access')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError) {
    return {
      ok: false,
      response: json(500, { error: 'Driver finance identity could not be verified.' }),
    };
  }
  if (!driver?.id || !driver.company_id || driver.status !== 'active' || driver.app_access !== true) {
    return {
      ok: false,
      response: json(403, { error: 'Active owner-driver or company-admin Driver access is required.' }),
    };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driver.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return {
      ok: false,
      response: json(500, { error: 'Finance workspace access could not be verified.' }),
    };
  }

  const role = String(membership?.role_in_company ?? '').trim().toLowerCase();
  if (role !== 'owner' && role !== 'admin') {
    return {
      ok: false,
      response: json(403, { error: 'Owner-driver or company-admin finance access is required.' }),
    };
  }

  return {
    ok: true,
    context: {
      userId: authData.user.id,
      driverId: String(driver.id),
      companyId: String(driver.company_id),
      role,
    },
  };
}
