import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const PAGE_SIZE = 1000;

type DocState = { status: string | null; expiry_date: string | null };
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

type PendingCompany = { id: string; company_number: string | null; email: string | null; status: string };
type EntityRow = { id: string; company_id: string };

type DriverDocRow = { driver_id: string; status: string | null; expiry_date: string | null };
type VehicleDocRow = { vehicle_id: string; status: string | null; expiry_date: string | null };

const loadPendingCompanies = async () => {
  if (!supabaseAdmin) return { rows: [] as PendingCompany[], error: 'Server auth is not configured.' };
  const rows: PendingCompany[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('companies')
      .select('id, company_number, email, status')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (result.error) return { rows: [] as PendingCompany[], error: result.error.message };
    const page = (result.data ?? []) as PendingCompany[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
};

const loadDocuments = async <T extends DriverDocRow | VehicleDocRow>(
  table: 'driver_documents' | 'vehicle_documents',
  foreignKey: 'driver_id' | 'vehicle_id',
  ids: string[],
) => {
  if (!supabaseAdmin || ids.length === 0) return { rows: [] as T[], error: null as string | null };
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += 500) {
    const chunk = ids.slice(start, start + 500);
    const result = await supabaseAdmin
      .from(table)
      .select(`${foreignKey}, status, expiry_date`)
      .in(foreignKey, chunk)
      .limit(10_000);
    if (result.error) return { rows: [] as T[], error: result.error.message };
    rows.push(...((result.data ?? []) as unknown as T[]));
  }
  return { rows, error: null as string | null };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const companyResult = await loadPendingCompanies();
  if (companyResult.error) return respond(500, { error: companyResult.error });
  const companies = companyResult.rows;
  const companyIds = companies.map((row) => row.id);
  if (companyIds.length === 0) return respond(200, { readiness: {}, totalPendingCompanies: 0 });

  const [driversResult, vehiclesResult] = await Promise.all([
    supabaseAdmin.from('drivers').select('id, company_id').in('company_id', companyIds).limit(10_000),
    supabaseAdmin.from('vehicles').select('id, company_id').in('company_id', companyIds).limit(10_000),
  ]);
  if (driversResult.error) return respond(500, { error: driversResult.error.message });
  if (vehiclesResult.error) return respond(500, { error: vehiclesResult.error.message });

  const drivers = (driversResult.data ?? []) as EntityRow[];
  const vehicles = (vehiclesResult.data ?? []) as EntityRow[];
  const [driverDocsResult, vehicleDocsResult] = await Promise.all([
    loadDocuments<DriverDocRow>('driver_documents', 'driver_id', drivers.map((row) => row.id)),
    loadDocuments<VehicleDocRow>('vehicle_documents', 'vehicle_id', vehicles.map((row) => row.id)),
  ]);
  if (driverDocsResult.error) return respond(500, { error: driverDocsResult.error });
  if (vehicleDocsResult.error) return respond(500, { error: vehicleDocsResult.error });

  const companyByDriver = new Map(drivers.map((row) => [row.id, row.company_id]));
  const companyByVehicle = new Map(vehicles.map((row) => [row.id, row.company_id]));
  const docsByCompany = new Map<string, DocState[]>();
  for (const row of driverDocsResult.rows) {
    const companyId = companyByDriver.get(row.driver_id);
    if (!companyId) continue;
    const list = docsByCompany.get(companyId) ?? [];
    list.push({ status: row.status, expiry_date: row.expiry_date });
    docsByCompany.set(companyId, list);
  }
  for (const row of vehicleDocsResult.rows) {
    const companyId = companyByVehicle.get(row.vehicle_id);
    if (!companyId) continue;
    const list = docsByCompany.get(companyId) ?? [];
    list.push({ status: row.status, expiry_date: row.expiry_date });
    docsByCompany.set(companyId, list);
  }

  const driverCountByCompany = new Map<string, number>();
  for (const row of drivers) driverCountByCompany.set(row.company_id, (driverCountByCompany.get(row.company_id) ?? 0) + 1);
  const vehicleCountByCompany = new Map<string, number>();
  for (const row of vehicles) vehicleCountByCompany.set(row.company_id, (vehicleCountByCompany.get(row.company_id) ?? 0) + 1);

  const today = new Date().toISOString().slice(0, 10);
  const readiness: Record<string, CompanyReadiness> = {};
  for (const company of companies) {
    const docs = docsByCompany.get(company.id) ?? [];
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
    readiness[company.id] = {
      companyId: company.id,
      registrationProvided,
      emailProvided,
      driverCount: driverCountByCompany.get(company.id) ?? 0,
      vehicleCount: vehicleCountByCompany.get(company.id) ?? 0,
      documentCount: docs.length,
      approvedDocuments,
      pendingDocuments,
      rejectedDocuments,
      expiredDocuments,
      readinessScore: score,
      readiness: blocked ? 'blocked' : needsReview ? 'review' : 'ready',
    };
  }

  return respond(200, { readiness, totalPendingCompanies: companies.length, refreshedAt: new Date().toISOString() });
}
