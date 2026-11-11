import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Authenticated company members may read their OWN declared fleet capability.
 * This does NOT grant edit access or expose driver phones, private addresses,
 * documents, financial data, exact positions, or vehicles of other companies.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin)
    return respond(503, { error: 'Company fleet service unavailable.' });

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Authentication required.' });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return respond(401, { error: 'Authentication required.' });

  const companyId = request.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  const includeDocuments = request.nextUrl.searchParams.get('includeDocuments') === 'true';
  if (!UUID.test(companyId)) return respond(400, { error: 'An active company ID is required.' });
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id,status,role_in_company')
    .eq('user_id', auth.user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (membershipError) return respond(503, { error: 'Company access could not be verified.' });
  if (!membership) return respond(403, { error: 'Company fleet records are not available to this account.' });

  const [vehicleResult,driverResult] = await Promise.all([
    supabaseAdmin.from('vehicles').select('id,reg_plate,type,body_type,payload_kg,pallets_capacity,has_tail_lift,assigned_driver_id,is_available').eq('company_id',companyId).limit(500),
    supabaseAdmin.from('drivers').select('id,display_name,status,availability_status').eq('company_id',companyId).limit(500),
  ]);

  // Never disguise a partial/failed query as an empty fleet.
  if (vehicleResult.error || driverResult.error)
    return respond(503, { error: 'Verified company fleet data could not be loaded.' });

  const canReadDocuments = ['owner','admin','fleet_manager','dispatcher'].includes(String(membership.role_in_company ?? '').toLowerCase());
  const documentsRestricted = includeDocuments && !canReadDocuments;
  const vehicleIds = (vehicleResult.data ?? []).map((vehicle) => vehicle.id);
  const documentsResult = includeDocuments && canReadDocuments && vehicleIds.length
    ? await supabaseAdmin.from('vehicle_documents')
      .select('id,vehicle_id,doc_type,status,expiry_date')
      .in('vehicle_id', vehicleIds)
      .limit(1000)
    : { data: [], error: null };
  const driverIds = (driverResult.data ?? []).map((driver) => driver.id);
  const driverDocumentsResult = includeDocuments && canReadDocuments && driverIds.length
    ? await supabaseAdmin.from('driver_documents')
      .select('id,driver_id,doc_type,status,expiry_date')
      .in('driver_id', driverIds)
      .limit(1000)
    : { data: [], error: null };
  const documentsUnavailable = Boolean(documentsResult.error) || Boolean(driverDocumentsResult.error);

  return respond(200, {
    companyId,
    vehicles: vehicleResult.data ?? [],
    drivers: driverResult.data ?? [],
    documents: documentsUnavailable ? [] : documentsResult.data ?? [],
    driverDocuments: documentsUnavailable ? [] : driverDocumentsResult.data ?? [],
    documentsUnavailable,
    documentsRestricted,
    limited: (vehicleResult.data?.length ?? 0) === 500 ||
      (driverResult.data?.length ?? 0) === 500 || documentsUnavailable || (documentsResult.data?.length ?? 0) === 1000 || (driverDocumentsResult.data?.length ?? 0) === 1000,
    access: 'own-company-read-only',
  });
}
