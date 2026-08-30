import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import type { DriverContext } from '../mobile/_lib';
import { respond } from '../mobile/_lib';

const isMissingDriverCommercialColumn = (
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
): boolean => {
  if (!error || error.code !== '42703') return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return text.includes('driver_type') || text.includes('can_commercial_bid');
};

/**
 * Browser/workspace driver authentication.
 *
 * This deliberately does not enforce driver_mobile_device_sessions. Native
 * device binding remains owned by requireDriver() in mobile/_lib and therefore
 * continues to protect the Expo/mobile API surface. Desktop CX-style Loads,
 * Advanced Search and quote flows authenticate the same approved driver/user
 * and company state without pretending the browser is a registered phone.
 */
export async function requireWebDriver(
  request: NextRequest,
  options: { requireOperationallyActive?: boolean } = {},
): Promise<DriverContext | NextResponse> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Invalid session.' });

  const [{ data: driverInitialRow, error: driverInitialError }, { data: profileRow, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id, company_id, user_id, app_access, status, driver_type, can_commercial_bid')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  const useLegacyDriverFallback = isMissingDriverCommercialColumn(driverInitialError);
  const { data: driverLegacyRow, error: driverLegacyError } = useLegacyDriverFallback
    ? await supabaseAdmin
        .from('drivers')
        .select('id, company_id, user_id, app_access, status')
        .eq('user_id', authData.user.id)
        .maybeSingle()
    : { data: null, error: null };
  const driverRow = useLegacyDriverFallback
    ? (driverLegacyRow ? { ...driverLegacyRow, driver_type: null, can_commercial_bid: false } : null)
    : driverInitialRow;
  const driverError = useLegacyDriverFallback ? driverLegacyError : driverInitialError;

  if (driverError) return respond(500, { error: driverError.message });
  if (profileError) return respond(500, { error: profileError.message });
  if (!profileRow) return respond(403, { error: 'Driver profile not found.' });
  if (!driverRow) return respond(403, { error: 'Driver record not found.' });
  if (driverRow.app_access !== true) {
    return respond(403, { error: 'Driver app access has not been approved.' });
  }

  const profileStatus = String(profileRow.status ?? '').trim().toLowerCase();
  const driverStatus = String(driverRow.status ?? '').trim().toLowerCase();
  if (options.requireOperationallyActive !== false) {
    if (profileStatus !== 'active') return respond(403, { error: 'Driver profile is not active.' });
    if (driverStatus !== 'active') return respond(403, { error: 'Driver account is not active.' });
  }

  const companyId = typeof driverRow.company_id === 'string' && driverRow.company_id.trim().length > 0
    ? driverRow.company_id.trim()
    : null;
  let companyStatus: string | null = null;
  if (companyId) {
    const { data: companyRow, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('status')
      .eq('id', companyId)
      .maybeSingle();
    if (companyError) return respond(500, { error: companyError.message });
    companyStatus = String(companyRow?.status ?? '').trim().toLowerCase() || null;
  }

  return {
    userId: authData.user.id,
    driverId: String(driverRow.id),
    companyId,
    driverStatus,
    appAccess: driverRow.app_access === true,
    driverType: typeof driverRow.driver_type === 'string' ? driverRow.driver_type : null,
    canCommercialBid: driverRow.can_commercial_bid === true,
    companyStatus,
  };
}
