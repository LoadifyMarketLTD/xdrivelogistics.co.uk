import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type DriverRow = { id: string; display_name: string | null; company_id: string };
type VehicleRow = { id: string; registration: string | null; company_id: string };
type CompanyRow = { id: string; name: string };

type SourceRow = {
  id: string;
  driver_id?: string | null;
  vehicle_id?: string | null;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date?: string | null;
  created_at: string;
};

const parsePage = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  return { page, limit, offset: (page - 1) * limit, required: page * limit };
};

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const companyNameMap = async (ids: string[]) => {
  const map = new Map<string, string>();
  if (!supabaseAdmin || ids.length === 0) return { map, error: null as string | null };
  const { data, error } = await supabaseAdmin.from('companies').select('id, name').in('id', Array.from(new Set(ids)));
  if (error) return { map, error: error.message };
  for (const company of (data ?? []) as CompanyRow[]) map.set(company.id, company.name);
  return { map, error: null as string | null };
};

const applyDocumentTypeFilter = <T extends { ilike: (column: string, pattern: string) => T; or: (filters: string) => T }>(query: T, section: string) => {
  if (section === 'insurance') return query.ilike('doc_type', '%insurance%');
  if (section === 'operator-licences') return query.or('doc_type.ilike.%operator%,doc_type.ilike.%o_licence%');
  return query;
};

const updateDocumentSchema = z.object({
  section: z.literal('documents'),
  entityType: z.enum(['driver', 'vehicle']),
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(5000).optional(),
});

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const { page, limit, offset, required } = parsePage(request);

  if (section === 'documents' || section === 'insurance' || section === 'operator-licences') {
    let driverQuery = supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, doc_type, status, expiry_date, issued_date, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    let vehicleQuery = supabaseAdmin
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, status, expiry_date, issued_date, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    driverQuery = applyDocumentTypeFilter(driverQuery, section);
    vehicleQuery = applyDocumentTypeFilter(vehicleQuery, section);

    const [driverResult, vehicleResult] = await Promise.all([
      driverQuery.range(0, required - 1),
      vehicleQuery.range(0, required - 1),
    ]);
    if (driverResult.error) return respond(500, { error: driverResult.error.message });
    if (vehicleResult.error) return respond(500, { error: vehicleResult.error.message });
    if (typeof driverResult.count !== 'number' || typeof vehicleResult.count !== 'number') {
      return respond(500, { error: 'Compliance document sources returned incomplete exact counts.' });
    }

    const driverDocs = (driverResult.data ?? []) as SourceRow[];
    const vehicleDocs = (vehicleResult.data ?? []) as SourceRow[];
    const driverIds = Array.from(new Set(driverDocs.map((row) => row.driver_id).filter((id): id is string => Boolean(id))));
    const vehicleIds = Array.from(new Set(vehicleDocs.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id))));
    const [driversResult, vehiclesResult] = await Promise.all([
      driverIds.length ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds) : Promise.resolve({ data: [], error: null }),
      vehicleIds.length ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (driversResult.error) return respond(500, { error: driversResult.error.message });
    if (vehiclesResult.error) return respond(500, { error: vehiclesResult.error.message });

    const driverById = new Map<string, DriverRow>(((driversResult.data ?? []) as DriverRow[]).map((row) => [row.id, row]));
    const vehicleById = new Map<string, VehicleRow>(((vehiclesResult.data ?? []) as VehicleRow[]).map((row) => [row.id, row]));
    const companyIds = Array.from(new Set([
      ...Array.from(driverById.values()).map((row) => row.company_id),
      ...Array.from(vehicleById.values()).map((row) => row.company_id),
    ].filter(Boolean)));
    const companyResult = await companyNameMap(companyIds);
    if (companyResult.error) return respond(500, { error: companyResult.error });

    const today = new Date().toISOString().slice(0, 10);
    const rows = [
      ...driverDocs.map((row) => {
        const driver = row.driver_id ? driverById.get(row.driver_id) : undefined;
        return {
          id: row.id,
          entity_type: 'driver',
          entity_name: driver?.display_name ?? 'Unknown Driver',
          company_name: driver?.company_id ? companyResult.map.get(driver.company_id) ?? 'Unknown company' : 'Unknown company',
          doc_type: row.doc_type,
          status: row.status,
          expiry_date: row.expiry_date,
          issued_date: row.issued_date ?? null,
          created_at: row.created_at,
          is_expired: row.expiry_date ? row.expiry_date < today : false,
        };
      }),
      ...vehicleDocs.map((row) => {
        const vehicle = row.vehicle_id ? vehicleById.get(row.vehicle_id) : undefined;
        return {
          id: row.id,
          entity_type: 'vehicle',
          entity_name: vehicle?.registration ?? 'Unknown Vehicle',
          company_name: vehicle?.company_id ? companyResult.map.get(vehicle.company_id) ?? 'Unknown company' : 'Unknown company',
          doc_type: row.doc_type,
          status: row.status,
          expiry_date: row.expiry_date,
          issued_date: row.issued_date ?? null,
          created_at: row.created_at,
          is_expired: row.expiry_date ? row.expiry_date < today : false,
        };
      }),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(offset, offset + limit);

    const total = driverResult.count + vehicleResult.count;
    return respond(200, {
      section,
      rows,
      summary: { total_records: total, page_records: rows.length },
      pagination: pagination(page, limit, total),
    });
  }

  if (section === 'expiries') {
    const today = new Date().toISOString().slice(0, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + 30);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    const [driverResult, vehicleResult] = await Promise.all([
      supabaseAdmin.from('driver_documents')
        .select('id, driver_id, doc_type, status, expiry_date, created_at', { count: 'exact' })
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true })
        .range(0, required - 1),
      supabaseAdmin.from('vehicle_documents')
        .select('id, vehicle_id, doc_type, status, expiry_date, created_at', { count: 'exact' })
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true })
        .range(0, required - 1),
    ]);
    if (driverResult.error) return respond(500, { error: driverResult.error.message });
    if (vehicleResult.error) return respond(500, { error: vehicleResult.error.message });
    if (typeof driverResult.count !== 'number' || typeof vehicleResult.count !== 'number') {
      return respond(500, { error: 'Expiry sources returned incomplete exact counts.' });
    }

    const driverDocs = (driverResult.data ?? []) as SourceRow[];
    const vehicleDocs = (vehicleResult.data ?? []) as SourceRow[];
    const driverIds = Array.from(new Set(driverDocs.map((row) => row.driver_id).filter((id): id is string => Boolean(id))));
    const vehicleIds = Array.from(new Set(vehicleDocs.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id))));
    const [driversResult, vehiclesResult] = await Promise.all([
      driverIds.length ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds) : Promise.resolve({ data: [], error: null }),
      vehicleIds.length ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (driversResult.error) return respond(500, { error: driversResult.error.message });
    if (vehiclesResult.error) return respond(500, { error: vehiclesResult.error.message });

    const driverById = new Map<string, DriverRow>(((driversResult.data ?? []) as DriverRow[]).map((row) => [row.id, row]));
    const vehicleById = new Map<string, VehicleRow>(((vehiclesResult.data ?? []) as VehicleRow[]).map((row) => [row.id, row]));
    const companyIds = Array.from(new Set([
      ...Array.from(driverById.values()).map((row) => row.company_id),
      ...Array.from(vehicleById.values()).map((row) => row.company_id),
    ].filter(Boolean)));
    const companyResult = await companyNameMap(companyIds);
    if (companyResult.error) return respond(500, { error: companyResult.error });

    const rows = [
      ...driverDocs.map((row) => {
        const driver = row.driver_id ? driverById.get(row.driver_id) : undefined;
        return {
          id: row.id, entity_type: 'driver', entity_name: driver?.display_name ?? 'Unknown Driver',
          company_name: driver?.company_id ? companyResult.map.get(driver.company_id) ?? 'Unknown company' : 'Unknown company',
          doc_type: row.doc_type, status: row.status, expiry_date: row.expiry_date,
          days_until_expiry: row.expiry_date ? Math.ceil((new Date(`${row.expiry_date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000) : null,
          is_expired: Boolean(row.expiry_date && row.expiry_date < today),
          expires_soon: Boolean(row.expiry_date && row.expiry_date >= today && row.expiry_date <= cutoff),
        };
      }),
      ...vehicleDocs.map((row) => {
        const vehicle = row.vehicle_id ? vehicleById.get(row.vehicle_id) : undefined;
        return {
          id: row.id, entity_type: 'vehicle', entity_name: vehicle?.registration ?? 'Unknown Vehicle',
          company_name: vehicle?.company_id ? companyResult.map.get(vehicle.company_id) ?? 'Unknown company' : 'Unknown company',
          doc_type: row.doc_type, status: row.status, expiry_date: row.expiry_date,
          days_until_expiry: row.expiry_date ? Math.ceil((new Date(`${row.expiry_date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000) : null,
          is_expired: Boolean(row.expiry_date && row.expiry_date < today),
          expires_soon: Boolean(row.expiry_date && row.expiry_date >= today && row.expiry_date <= cutoff),
        };
      }),
    ].sort((a, b) => String(a.expiry_date ?? '').localeCompare(String(b.expiry_date ?? ''))).slice(offset, offset + limit);

    const total = driverResult.count + vehicleResult.count;
    return respond(200, {
      section,
      rows,
      summary: { total_records: total, page_records: rows.length },
      pagination: pagination(page, limit, total),
    });
  }

  return respond(400, { error: 'Invalid section. Use documents, expiries, insurance, or operator-licences.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required. Deploy Preview is read-only.' });

  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, { error: 'Invalid JSON body.' }); }
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Validation failed.', details: parsed.error.flatten() });

  const { entityType, id, action, reason } = parsed.data;
  const table = entityType === 'driver' ? 'driver_documents' : 'vehicle_documents';
  const nextStatus = action === 'approve' ? 'approved' : 'rejected';
  const { data: currentDoc, error: currentError } = await supabaseAdmin
    .from(table)
    .select('id, status, verified_by, verified_at, rejection_reason')
    .eq('id', id)
    .maybeSingle();
  if (currentError) return respond(500, { error: currentError.message });
  if (!currentDoc) return respond(404, { error: 'Document not found.' });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from(table)
    .update({
      status: nextStatus,
      verified_by: owner.id,
      verified_at: new Date().toISOString(),
      rejection_reason: action === 'reject' ? reason?.trim() || 'Rejected by Platform Owner compliance review.' : null,
    })
    .eq('id', id)
    .select('id, status, rejection_reason, verified_at, verified_by')
    .maybeSingle();
  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'Document review did not update a record.' });

  const auditResult = await supabaseAdmin
    .from('owner_audit_log')
    .insert({
      actor_user_id: owner.id,
      target_type: `${entityType}_document`,
      target_company_id: null,
      action_type: action === 'approve' ? 'document_approved' : 'document_rejected',
      old_status: currentDoc.status ?? null,
      new_status: nextStatus,
      reason: reason?.trim() || `${entityType} document ${id} ${nextStatus} by Platform Owner compliance review.`,
      metadata: { document_id: id, entity_type: entityType },
    })
    .select('id')
    .maybeSingle();

  if (auditResult.error || !auditResult.data) {
    const rollback = await supabaseAdmin
      .from(table)
      .update({
        status: currentDoc.status,
        verified_by: currentDoc.verified_by,
        verified_at: currentDoc.verified_at,
        rejection_reason: currentDoc.rejection_reason,
      })
      .eq('id', id)
      .eq('status', nextStatus)
      .select('id')
      .maybeSingle();
    if (rollback.error || !rollback.data) {
      return respond(500, {
        error: 'Compliance audit persistence failed and automatic rollback could not be verified. Manual Platform Owner review is required before further mutation.',
        code: 'compliance_audit_rollback_unverified',
      });
    }
    return respond(500, { error: 'Compliance audit persistence failed. The document change was rolled back.', code: 'compliance_audit_failed_rolled_back' });
  }

  return respond(200, { document: updated, entityType, auditId: auditResult.data.id });
}
