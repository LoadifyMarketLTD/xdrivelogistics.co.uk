import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type DriverRow = { id: string; display_name: string | null; company_id: string };
type VehicleRow = { id: string; registration: string | null; company_id: string };
type CompanyRow = { id: string; name: string };

const companyNameMap = async (ids: string[]) => {
  if (!supabaseAdmin || ids.length === 0) return { map: new Map<string, string>(), error: null as string | null };
  const { data, error } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  if (error) return { map: new Map<string, string>(), error: error.message };
  return { map: new Map((data as CompanyRow[] ?? []).map((company) => [company.id, company.name])), error: null as string | null };
};

const updateDocumentSchema = z.object({
  section: z.literal('documents'),
  entityType: z.enum(['driver', 'vehicle']),
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(5000).optional(),
}).superRefine((value, ctx) => {
  if (value.action === 'reject' && (!value.reason || value.reason.trim().length < 5)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'A rejection reason of at least 5 characters is required.',
    });
  }
});

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  if (section === 'documents' || section === 'insurance' || section === 'operator-licences') {
    const docFilter: Record<string, string[]> = {
      insurance: ['insurance', 'public_liability', 'goods_in_transit'],
      'operator-licences': ['operator_licence', 'operators_licence', 'o_licence'],
    };

    const { data: driverDocs, error: ddErr } = await supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, doc_type, status, expiry_date, issued_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (ddErr) return respond(500, { error: ddErr.message });

    const { data: vehicleDocs, error: vdErr } = await supabaseAdmin
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, status, expiry_date, issued_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (vdErr) return respond(500, { error: vdErr.message });

    const driverIds = Array.from(new Set((driverDocs ?? []).map((document) => document.driver_id as string).filter(Boolean)));
    const vehicleIds = Array.from(new Set((vehicleDocs ?? []).map((document) => document.vehicle_id as string).filter(Boolean)));

    const [driversResult, vehiclesResult] = await Promise.all([
      driverIds.length > 0
        ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length > 0
        ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (driversResult.error) return respond(500, { error: `Failed to resolve document drivers: ${driversResult.error.message}` });
    if (vehiclesResult.error) return respond(500, { error: `Failed to resolve document vehicles: ${vehiclesResult.error.message}` });

    const driverById = new Map<string, DriverRow>((driversResult.data as DriverRow[] ?? []).map((driver) => [driver.id, driver]));
    const vehicleById = new Map<string, VehicleRow>((vehiclesResult.data as VehicleRow[] ?? []).map((vehicle) => [vehicle.id, vehicle]));

    const allCompanyIds = Array.from(new Set([
      ...(driversResult.data as DriverRow[] ?? []).map((driver) => driver.company_id),
      ...(vehiclesResult.data as VehicleRow[] ?? []).map((vehicle) => vehicle.company_id),
    ].filter(Boolean)));
    const names = await companyNameMap(allCompanyIds);
    if (names.error) return respond(500, { error: `Failed to resolve document companies: ${names.error}` });

    const today = new Date().toISOString().slice(0, 10);
    const filterByDocType = (docType: string, types: string[]): boolean =>
      types.some((type) => docType.toLowerCase().replace(/[^a-z0-9]/g, '').includes(type.replace(/[^a-z0-9]/g, '')));

    const driverDocRows = (driverDocs ?? [])
      .filter((document) => section in docFilter ? filterByDocType(document.doc_type as string, docFilter[section]) : true)
      .map((document) => {
        const driver = driverById.get(document.driver_id as string);
        const companyId = driver?.company_id ?? '';
        return {
          id: document.id,
          entity_type: 'driver',
          entity_id: document.driver_id,
          entity_name: driver?.display_name ?? 'Unknown Driver',
          company_name: names.map.get(companyId) ?? 'Unknown',
          doc_type: document.doc_type,
          status: document.status,
          expiry_date: document.expiry_date,
          issued_date: document.issued_date,
          created_at: document.created_at,
          is_expired: document.expiry_date ? document.expiry_date < today : false,
        };
      });

    const vehicleDocRows = (vehicleDocs ?? [])
      .filter((document) => section in docFilter ? filterByDocType(document.doc_type as string, docFilter[section]) : true)
      .map((document) => {
        const vehicle = vehicleById.get(document.vehicle_id as string);
        const companyId = vehicle?.company_id ?? '';
        return {
          id: document.id,
          entity_type: 'vehicle',
          entity_id: document.vehicle_id,
          entity_name: vehicle?.registration ?? 'Unknown Vehicle',
          company_name: names.map.get(companyId) ?? 'Unknown',
          doc_type: document.doc_type,
          status: document.status,
          expiry_date: document.expiry_date,
          issued_date: document.issued_date,
          created_at: document.created_at,
          is_expired: document.expiry_date ? document.expiry_date < today : false,
        };
      });

    const rows = [...driverDocRows, ...vehicleDocRows]
      .sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string))
      .slice(0, limit);

    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        approved: rows.filter((row) => row.status === 'approved').length,
        pending: rows.filter((row) => row.status === 'pending').length,
        rejected: rows.filter((row) => row.status === 'rejected').length,
        expired: rows.filter((row) => row.is_expired).length,
      },
    });
  }

  if (section === 'expiries') {
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const cutoff = thirtyDays.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [ddResult, vdResult] = await Promise.all([
      supabaseAdmin
        .from('driver_documents')
        .select('id, driver_id, doc_type, status, expiry_date, created_at')
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true })
        .limit(limit),
      supabaseAdmin
        .from('vehicle_documents')
        .select('id, vehicle_id, doc_type, status, expiry_date, created_at')
        .not('expiry_date', 'is', null)
        .order('expiry_date', { ascending: true })
        .limit(limit),
    ]);

    if (ddResult.error) return respond(500, { error: ddResult.error.message });
    if (vdResult.error) return respond(500, { error: vdResult.error.message });

    const driverIds = Array.from(new Set((ddResult.data ?? []).map((document) => document.driver_id as string).filter(Boolean)));
    const vehicleIds = Array.from(new Set((vdResult.data ?? []).map((document) => document.vehicle_id as string).filter(Boolean)));

    const [driversResult, vehiclesResult] = await Promise.all([
      driverIds.length > 0
        ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length > 0
        ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (driversResult.error) return respond(500, { error: `Failed to resolve expiry drivers: ${driversResult.error.message}` });
    if (vehiclesResult.error) return respond(500, { error: `Failed to resolve expiry vehicles: ${vehiclesResult.error.message}` });

    const driverById = new Map<string, DriverRow>((driversResult.data as DriverRow[] ?? []).map((driver) => [driver.id, driver]));
    const vehicleById = new Map<string, VehicleRow>((vehiclesResult.data as VehicleRow[] ?? []).map((vehicle) => [vehicle.id, vehicle]));

    const allCompanyIds = Array.from(new Set([
      ...(driversResult.data as DriverRow[] ?? []).map((driver) => driver.company_id),
      ...(vehiclesResult.data as VehicleRow[] ?? []).map((vehicle) => vehicle.company_id),
    ].filter(Boolean)));
    const names = await companyNameMap(allCompanyIds);
    if (names.error) return respond(500, { error: `Failed to resolve expiry companies: ${names.error}` });

    const driverExpiries = (ddResult.data ?? []).map((document) => ({
      id: document.id,
      entity_type: 'driver',
      entity_id: document.driver_id,
      entity_name: driverById.get(document.driver_id as string)?.display_name ?? 'Unknown Driver',
      company_name: names.map.get(driverById.get(document.driver_id as string)?.company_id ?? '') ?? 'Unknown',
      doc_type: document.doc_type,
      status: document.status,
      expiry_date: document.expiry_date,
      days_until_expiry: Math.round((new Date(document.expiry_date as string).getTime() - Date.now()) / 86400000),
      is_expired: (document.expiry_date as string) < today,
      expires_soon: (document.expiry_date as string) <= cutoff && (document.expiry_date as string) >= today,
    }));

    const vehicleExpiries = (vdResult.data ?? []).map((document) => ({
      id: document.id,
      entity_type: 'vehicle',
      entity_id: document.vehicle_id,
      entity_name: vehicleById.get(document.vehicle_id as string)?.registration ?? 'Unknown Vehicle',
      company_name: names.map.get(vehicleById.get(document.vehicle_id as string)?.company_id ?? '') ?? 'Unknown',
      doc_type: document.doc_type,
      status: document.status,
      expiry_date: document.expiry_date,
      days_until_expiry: Math.round((new Date(document.expiry_date as string).getTime() - Date.now()) / 86400000),
      is_expired: (document.expiry_date as string) < today,
      expires_soon: (document.expiry_date as string) <= cutoff && (document.expiry_date as string) >= today,
    }));

    const rows = [...driverExpiries, ...vehicleExpiries]
      .sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string));

    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        expired: rows.filter((row) => row.is_expired).length,
        expiresSoon: rows.filter((row) => row.expires_soon).length,
        valid: rows.filter((row) => !row.is_expired && !row.expires_soon).length,
      },
    });
  }

  return respond(400, { error: 'Invalid section. Use documents, expiries, insurance, or operator-licences.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: parsed.error.issues[0]?.message ?? 'Validation failed.',
      details: parsed.error.flatten(),
    });
  }

  const { entityType, id, action, reason } = parsed.data;
  const { data, error } = await supabaseAdmin.rpc('owner_review_compliance_document', {
    p_actor_user_id: owner.id,
    p_document_family: entityType,
    p_document_id: id,
    p_action: action,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    if (error.code === 'P0002') return respond(404, { error: error.message });
    if (error.code === '42501') return respond(403, { error: error.message });
    if (error.code === '23514' || error.code === '23502' || error.code === '22P02') return respond(409, { error: error.message });
    if (error.code === 'PGRST202' || error.code === '42883') return respond(503, { error: 'Canonical compliance review RPC is not available in this environment.' });
    return respond(500, { error: error.message });
  }

  const review = Array.isArray(data) ? data[0] ?? null : data;
  if (!review) return respond(500, { error: 'Compliance review returned no authoritative result.' });

  return respond(200, { review, entityType, action });
}
