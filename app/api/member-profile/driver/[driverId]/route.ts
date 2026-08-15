import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { operationalError } from '../../../_lib/operationalError';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function GET(request: NextRequest, { params }: { params: Promise<{ driverId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Member profiles are temporarily unavailable.',
      context: 'member-profile.driver.config',
      retryable: true,
    });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const [membershipResult, viewerDriverResult] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('company_id, status')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('id, status, is_active, app_access')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (membershipResult.error || viewerDriverResult.error) {
    return operationalError({
      status: 500,
      message: 'Your member access could not be verified.',
      context: `member-profile.driver.viewer:${authData.user.id}`,
      cause: membershipResult.error ?? viewerDriverResult.error,
      retryable: true,
    });
  }

  const viewerDriverStatus = String(viewerDriverResult.data?.status ?? '').trim().toLowerCase();
  const activeDriverViewer = Boolean(viewerDriverResult.data)
    && viewerDriverStatus === 'active'
    && viewerDriverResult.data?.is_active !== false
    && viewerDriverResult.data?.app_access === true;
  if (!membershipResult.data && !activeDriverViewer) {
    return respond(403, { error: 'An active XDrive workspace membership is required to view member profiles.' });
  }

  const { driverId } = await params;
  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, display_name, status, availability_status')
    .eq('id', driverId)
    .maybeSingle();

  if (driverError) {
    return operationalError({
      status: 500,
      message: 'The owner-driver profile could not be loaded.',
      context: `member-profile.driver:${driverId}`,
      cause: driverError,
      retryable: true,
    });
  }
  if (!driver || String(driver.status ?? '').trim().toLowerCase() !== 'active') {
    return respond(404, { error: 'This owner-driver member is not available.' });
  }

  // Company-backed drivers should normally open the company member profile.
  // This endpoint exists for the independent/owner-driver identity case and is
  // deliberately conservative: personal phone/email/address and compliance
  // evidence are not part of the member-facing projection.
  const { data: vehicle, error: vehicleError } = await supabaseAdmin
    .from('vehicles')
    .select('type')
    .eq('assigned_driver_id', driver.id)
    .limit(1)
    .maybeSingle();

  return respond(200, {
    member: {
      companyId: driver.company_id ?? null,
      driverId: driver.id,
      name: driver.display_name?.trim() || 'Owner Driver',
      memberId: null,
      businessPhone: null,
      memberType: driver.company_id ? 'Company Driver' : 'Owner Driver',
      memberSince: null,
      status: 'active',
      availability: driver.availability_status ?? null,
      vehicleType: vehicleError ? null : vehicle?.type ?? null,
    },
    sections: {
      feedback: {
        state: 'unavailable',
        message: 'Owner-driver member-level feedback attribution is not exposed by the current verified XDrive data contract.',
      },
      users: {
        state: 'restricted',
        message: 'Private account identity is not published through the member profile contract.',
      },
      specialistServices: {
        state: 'unavailable',
        message: 'Verified specialist-service declarations are not currently exposed for this owner-driver member.',
      },
      charges: {
        state: 'unavailable',
        message: 'Owner-driver charge cards are not currently exposed as a verified member-visible dataset.',
      },
      bookingFooter: {
        state: 'unavailable',
        message: 'Owner-driver booking-footer terms are not currently exposed as a verified member-visible dataset.',
      },
      businessDocuments: {
        state: 'restricted',
        message: 'Driver compliance and document evidence is private until a dedicated member-visible permission contract exists.',
      },
    },
    partial: Boolean(vehicleError),
  });
}
