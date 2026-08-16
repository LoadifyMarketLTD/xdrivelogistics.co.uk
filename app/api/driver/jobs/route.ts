import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import {
  driverJobStatusesForScope,
  jobLifecyclePresentationGroup,
} from '../../../../lib/jobs/jobLifecyclePresentation';
import { workspaceJobPresentationStatus } from '../../../../lib/jobs/workspaceJobStage';
import { loadDriverAgreedRates } from '../_lib/commercialRate';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type DriverJobRow = {
  id: string;
  status: string | null;
  current_status: string | null;
  assigned_driver_id: string | null;
  assigned_company_id: string | null;
  vehicle_id: string | null;
  company_id: string | null;
  awarded_carrier_company_id: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  requested_vehicle_label: string | null;
  requested_vehicle_type: string | null;
  vehicle_type: string | null;
  requested_cargo_label: string | null;
  cargo_type: string | null;
  agreed_rate_gbp: number | string | null;
  agreed_rate: number | string | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Driver jobs are temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized — invalid or expired token.' });
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, status')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (driverError) return json(500, { error: 'We could not load your driver profile.' });
  if (!driver || String(driver.status ?? '').toLowerCase() !== 'active') {
    return json(403, { error: 'Active driver profile required.' });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'all';
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 250);
  const statusList = driverJobStatusesForScope(scope);

  let query = supabaseAdmin
    .from('jobs')
    .select([
      'id',
      'status',
      'current_status',
      'assigned_driver_id',
      'assigned_company_id',
      'vehicle_id',
      'company_id',
      'awarded_carrier_company_id',
      'pickup_location',
      'delivery_location',
      'pickup_datetime',
      'requested_vehicle_label',
      'requested_vehicle_type',
      'vehicle_type',
      'requested_cargo_label',
      'cargo_type',
      'agreed_rate_gbp',
      'agreed_rate',
      'currency',
      'created_at',
      'updated_at',
    ].join(','))
    .eq('assigned_driver_id', driver.id)
    .order(scope === 'completed' ? 'updated_at' : 'pickup_datetime', { ascending: scope !== 'completed' })
    .limit(limit);

  if (statusList) {
    const statuses = statusList.join(',');
    query = query.or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`);
  }

  const { data, error } = await query;
  if (error) return json(500, { error: 'We could not load your assigned jobs.' });

  const rows = (data ?? []) as unknown as DriverJobRow[];
  const commercial = await loadDriverAgreedRates(supabaseAdmin, rows);
  const companyIds = [...new Set(rows.map((row) => row.company_id).filter((value): value is string => Boolean(value)))];
  const companyNames = new Map<string, string>();

  if (companyIds.length > 0) {
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    for (const company of companies ?? []) {
      if (company.id && company.name) companyNames.set(String(company.id), String(company.name));
    }
  }

  return json(200, {
    scope,
    jobs: rows.map((row) => {
      const canonicalStatus = workspaceJobPresentationStatus(row);
      return {
        id: row.id,
        reference: `XDL-${row.id.slice(0, 8).toUpperCase()}`,
        pickupLocation: row.pickup_location,
        deliveryLocation: row.delivery_location,
        pickupTime: row.pickup_datetime,
        vehicleType: row.requested_vehicle_label ?? row.requested_vehicle_type ?? row.vehicle_type,
        cargoType: row.requested_cargo_label ?? row.cargo_type,
        canonicalStatus,
        lifecycleGroup: jobLifecyclePresentationGroup(canonicalStatus),
        agreedRateAmount: commercial.rates.get(row.id) ?? null,
        currency: row.currency ?? 'GBP',
        postingCompanyName: row.company_id ? companyNames.get(row.company_id) ?? null : null,
        awardedCarrierCompanyId: row.awarded_carrier_company_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
    commercialRatePartial: commercial.partial,
  });
}
