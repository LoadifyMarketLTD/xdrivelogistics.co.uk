import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../_lib/requireCompanyAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DbRow = Record<string, unknown>;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const text = (value: unknown, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const rows = (value: unknown): DbRow[] => Array.isArray(value) ? value as DbRow[] : [];

const documentStats = (
  items: DbRow[],
  statusColumn: string,
  approvedValues: string[],
) => {
  const today = new Date().toISOString().slice(0, 10);
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let expired = 0;
  for (const item of items) {
    const status = text(item[statusColumn], 40);
    const expiry = text(item.expiry_date, 10);
    if (expiry && expiry < today) {
      expired += 1;
    } else if (approvedValues.includes(status)) {
      approved += 1;
    } else if (status === 'rejected') {
      rejected += 1;
    } else {
      pending += 1;
    }
  }
  return { total: items.length, approved, pending, rejected, expired };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Fleet readiness service is temporarily unavailable.' });
  }

  const companyId = text(new URL(request.url).searchParams.get('companyId'), 80);
  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const [driverResult, vehicleResult] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id, user_id, display_name, status, is_active, app_access, can_commercial_bid')
      .eq('company_id', admin.companyId)
      .order('display_name'),
    supabaseAdmin
      .from('vehicles')
      .select('id, assigned_driver_id, reg_plate, registration, status')
      .eq('company_id', admin.companyId),
  ]);

  if (driverResult.error) return json(500, { error: 'Unable to load Fleet Drivers.' });
  if (vehicleResult.error) return json(500, { error: 'Unable to load Fleet Vehicles.' });

  const drivers = rows(driverResult.data);
  const vehicles = rows(vehicleResult.data);
  const userIds = drivers.map((driver) => text(driver.user_id, 80)).filter(Boolean);

  const appResult = userIds.length
    ? await supabaseAdmin
        .from('onboarding_applications')
        .select('id, user_id, company_id, account_type, status, risk_status, created_at')
        .eq('company_id', admin.companyId)
        .eq('account_type', 'individual_driver')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  if (appResult.error) return json(500, { error: 'Unable to load Driver onboarding state.' });

  const latestAppByUser = new Map<string, DbRow>();
  for (const application of rows(appResult.data)) {
    const userId = text(application.user_id, 80);
    if (userId && !latestAppByUser.has(userId)) latestAppByUser.set(userId, application);
  }

  const applicationIds = Array.from(latestAppByUser.values()).map((application) => text(application.id, 80));
  const identityResult = applicationIds.length
    ? await supabaseAdmin
        .from('driver_identity_documents')
        .select('id, onboarding_application_id, verification_status, expiry_date')
        .in('onboarding_application_id', applicationIds)
    : { data: [], error: null };
  if (identityResult.error) return json(500, { error: 'Unable to load Driver compliance state.' });

  const vehicleIds = vehicles.map((vehicle) => text(vehicle.id, 80)).filter(Boolean);
  const vehicleDocumentResult = vehicleIds.length
    ? await supabaseAdmin
        .from('vehicle_documents')
        .select('id, vehicle_id, status, expiry_date')
        .in('vehicle_id', vehicleIds)
    : { data: [], error: null };
  if (vehicleDocumentResult.error) return json(500, { error: 'Unable to load Vehicle compliance state.' });

  const identityDocsByApp = new Map<string, DbRow[]>();
  for (const document of rows(identityResult.data)) {
    const id = text(document.onboarding_application_id, 80);
    identityDocsByApp.set(id, [...(identityDocsByApp.get(id) ?? []), document]);
  }
  const vehicleDocsByVehicle = new Map<string, DbRow[]>();
  for (const document of rows(vehicleDocumentResult.data)) {
    const id = text(document.vehicle_id, 80);
    vehicleDocsByVehicle.set(id, [...(vehicleDocsByVehicle.get(id) ?? []), document]);
  }

  const readinessRows = await Promise.all(drivers.map(async (driver) => {
    const driverId = text(driver.id, 80);
    const userId = text(driver.user_id, 80);
    const application = userId ? latestAppByUser.get(userId) : undefined;
    const applicationId = text(application?.id, 80);

    const [eligibilityResult, missingResult] = await Promise.all([
      supabaseAdmin!.rpc('driver_operational_eligibility', { p_driver_id: driverId }),
      applicationId
        ? supabaseAdmin!.rpc('get_missing_onboarding_documents', { p_application_id: applicationId })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const eligibility = rows(eligibilityResult.data)[0] ?? {};
    const rawBlockers = Array.isArray(eligibility.blockers)
      ? eligibility.blockers.map((value) => String(value))
      : eligibilityResult.error
        ? ['readiness_check_failed']
        : [];

    const activeVehicles = vehicles.filter((vehicle) =>
      text(vehicle.assigned_driver_id, 80) === driverId && text(vehicle.status, 30) === 'active');
    const assignedVehicle = activeVehicles.length === 1 ? activeVehicles[0] : null;
    const assignedVehicleId = text(assignedVehicle?.id, 80);
    const identityDocuments = applicationId ? identityDocsByApp.get(applicationId) ?? [] : [];
    const vehicleDocuments = assignedVehicleId ? vehicleDocsByVehicle.get(assignedVehicleId) ?? [] : [];

    const missingDocuments = missingResult.error
      ? [{ document_family: 'identity', doc_type: 'unknown', reason: 'Compliance requirements could not be resolved.' }]
      : rows(missingResult.data).map((item) => ({
          document_family: text(item.document_family, 40),
          doc_type: text(item.doc_type, 100),
          reason: text(item.reason, 500),
        }));

    return {
      driver_id: driverId,
      display_name: text(driver.display_name) || 'Driver',
      operationally_ready: eligibility.eligible === true && !eligibilityResult.error,
      blockers: rawBlockers,
      account: {
        status: text(driver.status, 40),
        is_active: driver.is_active === true,
        app_access: driver.app_access === true,
        can_commercial_bid: driver.can_commercial_bid === true,
      },
      onboarding: {
        application_id: applicationId || null,
        status: text(application?.status, 40) || 'missing',
        risk_status: text(application?.risk_status, 40) || 'unknown',
        missing_documents: missingDocuments,
        documents: documentStats(identityDocuments, 'verification_status', ['verified']),
      },
      vehicle: {
        active_assigned_count: activeVehicles.length,
        id: assignedVehicleId || null,
        registration: text(assignedVehicle?.reg_plate) || text(assignedVehicle?.registration) || null,
        documents: documentStats(vehicleDocuments, 'status', ['approved']),
      },
    };
  }));

  return json(200, {
    companyId: admin.companyId,
    rows: readinessRows,
    summary: {
      total: readinessRows.length,
      operationally_ready: readinessRows.filter((row) => row.operationally_ready).length,
      blocked: readinessRows.filter((row) => !row.operationally_ready).length,
      missing_onboarding_documents: readinessRows.filter((row) => row.onboarding.missing_documents.length > 0).length,
      vehicle_assignment_attention: readinessRows.filter((row) => row.vehicle.active_assigned_count !== 1).length,
    },
  });
}
