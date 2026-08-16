import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export type WebDriverContext = {
  userId: string;
  driverId: string;
  companyId: string | null;
};

const respond = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Authentication boundary for Driver Web workspace reads/actions.
 *
 * `drivers.app_access` is intentionally NOT checked here. That flag belongs to
 * the native/mobile app gate and to the approved commercial quote eligibility
 * contract. Web workspace access is authenticated independently and individual
 * mutations still enforce their own business/eligibility rules.
 */
export async function requireActiveWebDriver(
  request: NextRequest,
): Promise<WebDriverContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, 'Driver workspace is temporarily unavailable.');
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, 'Unauthorized — missing bearer token.');

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, 'Unauthorized — invalid or expired token.');
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError) return respond(500, 'We could not load your driver profile.');
  if (!driver || String(driver.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(403, 'Active driver profile required.');
  }

  return {
    userId: authData.user.id,
    driverId: String(driver.id),
    companyId: typeof driver.company_id === 'string' && driver.company_id.trim() ? driver.company_id.trim() : null,
  };
}

export function isWebDriverContext(value: WebDriverContext | NextResponse): value is WebDriverContext {
  return !(value instanceof NextResponse);
}
