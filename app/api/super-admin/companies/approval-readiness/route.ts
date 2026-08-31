import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type DocState = {
  status: string | null;
  expiry_date: string | null;
};

type CompanyReadiness = {
  companyId: string;
  registrationProvided: boolean;
  emailProvided: boolean;
  driverCount: number;
  vehicleCount: number;
  documentCount: number;
  approvedDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  expiredDocuments: number;
  readinessScore: number;
  readiness: 'ready' | 'review' | 'blocked';
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { data: companies, error: companiesError } = await supabaseAdmin
    .from('companies')
    .select('id, company_number, email, status')
    .in('status', ['pending', 'pending_approval'])
    .order('created_at', { ascending: false })
    .limit(200);

  if (companiesError) return respond(500, { error: companiesError.message });

  const companyIds = (companies ?? []).map((row) => String(row.id)).filter(Boolean);
  if (companyIds.length === 0) return respond(200, { readiness: {} });

  const [driversResult, vehiclesResult] = await Promise.all([
    supabaseAdmin.from('drivers').select('id, company_id').in('company_id', companyIds),
    supabaseAdmin.from('vehicles').select('id, company_id').in('company_id', companyIds),
  ]);

  if (driversResult.error) return respond(500, { error: driversResult.error.message });
  if (vehiclesResult.error) return respond(500, { error: vehiclesResult.error.message });

  const drivers = driversResult.data ?? [];
  const vehicles = vehiclesResult.data ?? [];
  const driverIds = drivers.map((row) => String(row.id)).filter(Boolean);
  const vehicleIds = vehicles.map((row) => String(row.id)).filter(Boolean);

  const [driverDocsResult, vehicleDocsResult] = await Promise.all([
    driverIds.length
      ? supabaseAdmin.from('driver_documents').select('driver_id, status, expiry_date').in('driver_id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? supabaseAdmin.from('vehicle_documents').select('vehicle_id, status, expiry_date').in('vehicle_id', vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driverDocsResult.error) return respond(500, { error: driverDocsResult.error.message });
  if (vehicleDocsResult.error) return respond(500, { error: vehicleDocsResult.error.message });

  const companyByDriver = new Map(drivers.map((row) => [String(row.id), String(row.company_id)]));
  const companyByVehicle = new Map(vehicles.map((row) => [String(row.id), String(row.company_id)]));
  const docsByCompany = new Map<string, DocState[]>();

  for (const row of driverDocsResult.data ?? []) {
    const companyId = companyByDriver.get(String(row.driver_id));
    if (!companyId) continue;
    const list = docsByCompany.get(companyId) ?? [];
    list.push({ status: row.status ? String(row.status) : null, expiry_date: row.expiry_date ? String(row.expiry_date) : null });
    docsByCompany.set(companyId, list);
  }

  for (const row of vehicleDocsResult.data ?? []) {
    const companyId = companyByVehicle.get(String(row.vehicle_id));
    if (!companyId) continue;
    const list = docsByCompany.get(companyId) ?? [];
    list.push({ status: row.status ? String(row.status) : null, expiry_date: row.expiry_date ? String(row.expiry_date) : null });
    docsByCompany.set(companyId, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  const readiness: Record<string, CompanyReadiness> = {};

  for (const company of companies ?? []) {
    const companyId = String(company.id);
    const docs = docsByCompany.get(companyId) ?? [];
    const driverCount = drivers.filter((row) => String(row.company_id) === companyId).length;
    const vehicleCount = vehicles.filter((row) => String(row.company_id) === companyId).length;
    const approvedDocuments = docs.filter((doc) => doc.status === 'approved').length;
    const pendingDocuments = docs.filter((doc) => doc.status === 'pending').length;
    const rejectedDocuments = docs.filter((doc) => doc.status === 'rejected').length;
    const expiredDocuments = docs.filter((doc) => Boolean(doc.expiry_date && doc.expiry_date < today)).length;
    const registrationProvided = Boolean(String(company.company_number ?? '').trim());
    const emailProvided = Boolean(String(company.email ?? '').trim());

    let score = 0;
    if (registrationProvided) score += 30;
    if (emailProvided) score += 20;
    if (docs.length === 0) score += 10;
    else score += Math.round((approvedDocuments / docs.length) * 40);
    if (rejectedDocuments === 0 && expiredDocuments === 0) score += 10;
    score = Math.max(0, Math.min(100, score));

    const blocked = rejectedDocuments > 0 || expiredDocuments > 0;
    const needsReview = !registrationProvided || !emailProvided || pendingDocuments > 0;

    readiness[companyId] = {
      companyId,
      registrationProvided,
      emailProvided,
      driverCount,
      vehicleCount,
      documentCount: docs.length,
      approvedDocuments,
      pendingDocuments,
      rejectedDocuments,
      expiredDocuments,
      readinessScore: score,
      readiness: blocked ? 'blocked' : needsReview ? 'review' : 'ready',
    };
  }

  return respond(200, { readiness });
}
