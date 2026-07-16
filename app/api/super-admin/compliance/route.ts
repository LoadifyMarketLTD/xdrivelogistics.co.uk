import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const documentTargetSchema = z.object({
  documentId: z.string().uuid(),
  entityType: z.enum(['driver', 'vehicle']),
});

const viewDocumentSchema = documentTargetSchema.extend({
  action: z.literal('view'),
});

const reviewDocumentSchema = documentTargetSchema.extend({
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.action === 'reject' && !value.reason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'A rejection reason is required.',
    });
  }
});

const resolveStorageObjectPath = (filePath: string, bucket: string): string | null => {
  const plainPrefix = `${bucket}/`;
  if (!/^https?:\/\//i.test(filePath)) {
    return filePath.startsWith(plainPrefix) ? filePath.slice(plainPrefix.length) : filePath;
  }

  try {
    const pathname = new URL(filePath).pathname;
    const markers = [
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    if (!marker) return null;
    return decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
  } catch {
    return null;
  }
};

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

type DriverRow = { id: string; display_name: string | null; company_id: string };
type VehicleRow = { id: string; registration: string | null; company_id: string };
type CompanyRow = { id: string; name: string };

const companyNameMap = async (ids: string[]): Promise<Map<string, string>> => {
  if (!supabaseAdmin || ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  return new Map((data as CompanyRow[] ?? []).map((c) => [c.id, c.name]));
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  // ── Driver Documents ─────────────────────────────────────────────────────────
  if (section === 'documents' || section === 'insurance' || section === 'operator-licences') {
    const docFilter: Record<string, string[]> = {
      insurance: ['insurance', 'public_liability', 'goods_in_transit'],
      'operator-licences': ['operator_licence', 'operators_licence', 'o_licence'],
    };

    const { data: driverDocs, error: ddErr } = await supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, doc_type, status, expiry_date, issued_date, rejection_reason, verified_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (ddErr) return respond(500, { error: ddErr.message });

    const { data: vehicleDocs, error: vdErr } = await supabaseAdmin
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, status, expiry_date, issued_date, rejection_reason, verified_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (vdErr) return respond(500, { error: vdErr.message });

    const driverIds = Array.from(new Set((driverDocs ?? []).map((d) => d.driver_id as string).filter(Boolean)));
    const vehicleIds = Array.from(new Set((vehicleDocs ?? []).map((d) => d.vehicle_id as string).filter(Boolean)));

    const [driversResult, vehiclesResult] = await Promise.all([
      driverIds.length > 0
        ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length > 0
        ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const driverById = new Map<string, DriverRow>(
      (driversResult.data as DriverRow[] ?? []).map((d) => [d.id, d]),
    );
    const vehicleById = new Map<string, VehicleRow>(
      (vehiclesResult.data as VehicleRow[] ?? []).map((v) => [v.id, v]),
    );

    const allCompanyIds = Array.from(
      new Set([
        ...(driversResult.data as DriverRow[] ?? []).map((d) => d.company_id),
        ...(vehiclesResult.data as VehicleRow[] ?? []).map((v) => v.company_id),
      ].filter(Boolean)),
    );
    const nameById = await companyNameMap(allCompanyIds);

    const today = new Date().toISOString().slice(0, 10);

    const filterByDocType = (docType: string, types: string[]): boolean =>
      types.some((t) => docType.toLowerCase().replace(/[^a-z0-9]/g, '').includes(t.replace(/[^a-z0-9]/g, '')));

    const driverDocRows = (driverDocs ?? [])
      .filter((d) => {
        if (section in docFilter) return filterByDocType(d.doc_type as string, docFilter[section]);
        return true;
      })
      .map((d) => {
        const driver = driverById.get(d.driver_id as string);
        const companyId = driver?.company_id ?? '';
        return {
          id: d.id,
          entity_type: 'driver',
          entity_name: driver?.display_name ?? 'Unknown Driver',
          company_name: nameById.get(companyId) ?? 'Unknown',
          doc_type: d.doc_type,
          status: d.status,
          expiry_date: d.expiry_date,
          issued_date: d.issued_date,
          rejection_reason: d.rejection_reason,
          verified_at: d.verified_at,
          created_at: d.created_at,
          is_expired: d.expiry_date ? d.expiry_date < today : false,
        };
      });

    const vehicleDocRows = (vehicleDocs ?? [])
      .filter((d) => {
        if (section in docFilter) return filterByDocType(d.doc_type as string, docFilter[section]);
        return true;
      })
      .map((d) => {
        const vehicle = vehicleById.get(d.vehicle_id as string);
        const companyId = vehicle?.company_id ?? '';
        return {
          id: d.id,
          entity_type: 'vehicle',
          entity_name: vehicle?.registration ?? 'Unknown Vehicle',
          company_name: nameById.get(companyId) ?? 'Unknown',
          doc_type: d.doc_type,
          status: d.status,
          expiry_date: d.expiry_date,
          issued_date: d.issued_date,
          rejection_reason: d.rejection_reason,
          verified_at: d.verified_at,
          created_at: d.created_at,
          is_expired: d.expiry_date ? d.expiry_date < today : false,
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
        approved: rows.filter((r) => r.status === 'approved').length,
        pending: rows.filter((r) => r.status === 'pending').length,
        rejected: rows.filter((r) => r.status === 'rejected').length,
        expired: rows.filter((r) => r.is_expired).length,
      },
    });
  }

  // ── Expiry Tracking ──────────────────────────────────────────────────────────
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

    const driverIds = Array.from(new Set((ddResult.data ?? []).map((d) => d.driver_id as string).filter(Boolean)));
    const vehicleIds = Array.from(new Set((vdResult.data ?? []).map((d) => d.vehicle_id as string).filter(Boolean)));

    const [driversResult, vehiclesResult] = await Promise.all([
      driverIds.length > 0
        ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length > 0
        ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const driverById = new Map<string, DriverRow>(
      (driversResult.data as DriverRow[] ?? []).map((d) => [d.id, d]),
    );
    const vehicleById = new Map<string, VehicleRow>(
      (vehiclesResult.data as VehicleRow[] ?? []).map((v) => [v.id, v]),
    );

    const allCompanyIds = Array.from(
      new Set([
        ...(driversResult.data as DriverRow[] ?? []).map((d) => d.company_id),
        ...(vehiclesResult.data as VehicleRow[] ?? []).map((v) => v.company_id),
      ].filter(Boolean)),
    );
    const nameById = await companyNameMap(allCompanyIds);

    const driverExpiries = (ddResult.data ?? []).map((d) => ({
      id: d.id,
      entity_type: 'driver',
      entity_name: driverById.get(d.driver_id as string)?.display_name ?? 'Unknown Driver',
      company_name: nameById.get(driverById.get(d.driver_id as string)?.company_id ?? '') ?? 'Unknown',
      doc_type: d.doc_type,
      status: d.status,
      expiry_date: d.expiry_date,
      days_until_expiry: Math.round((new Date(d.expiry_date as string).getTime() - Date.now()) / 86400000),
      is_expired: (d.expiry_date as string) < today,
      expires_soon: (d.expiry_date as string) <= cutoff && (d.expiry_date as string) >= today,
    }));

    const vehicleExpiries = (vdResult.data ?? []).map((d) => ({
      id: d.id,
      entity_type: 'vehicle',
      entity_name: vehicleById.get(d.vehicle_id as string)?.registration ?? 'Unknown Vehicle',
      company_name: nameById.get(vehicleById.get(d.vehicle_id as string)?.company_id ?? '') ?? 'Unknown',
      doc_type: d.doc_type,
      status: d.status,
      expiry_date: d.expiry_date,
      days_until_expiry: Math.round((new Date(d.expiry_date as string).getTime() - Date.now()) / 86400000),
      is_expired: (d.expiry_date as string) < today,
      expires_soon: (d.expiry_date as string) <= cutoff && (d.expiry_date as string) >= today,
    }));

    const rows = [...driverExpiries, ...vehicleExpiries]
      .sort((a, b) => (a.expiry_date as string).localeCompare(b.expiry_date as string));

    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        expired: rows.filter((r) => r.is_expired).length,
        expiresSoon: rows.filter((r) => r.expires_soon).length,
        valid: rows.filter((r) => !r.is_expired && !r.expires_soon).length,
      },
    });
  }

  return respond(400, { error: 'Invalid section. Use documents, expiries, insurance, or operator-licences.' });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const parsed = viewDocumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid document request.' });

  const table = parsed.data.entityType === 'driver' ? 'driver_documents' : 'vehicle_documents';
  const bucket = parsed.data.entityType === 'driver' ? 'driver-docs' : 'vehicle-docs';
  const { data: document, error: documentError } = await supabaseAdmin
    .from(table)
    .select('id, file_path')
    .eq('id', parsed.data.documentId)
    .maybeSingle();

  if (documentError) return respond(500, { error: documentError.message });
  if (!document) return respond(404, { error: 'Document not found.' });
  if (!document.file_path) return respond(409, { error: 'This document has no uploaded file.' });

  const objectPath = resolveStorageObjectPath(document.file_path, bucket);
  if (!objectPath) return respond(409, { error: 'The stored document reference is invalid.' });

  const { data: signedFile, error: signedUrlError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(objectPath, 60 * 5);

  if (signedUrlError || !signedFile?.signedUrl) {
    return respond(500, { error: signedUrlError?.message ?? 'Unable to open the document.' });
  }

  return respond(200, { signedUrl: signedFile.signedUrl, expiresIn: 300 });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const parsed = reviewDocumentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid review action.' });
  }

  const table = parsed.data.entityType === 'driver' ? 'driver_documents' : 'vehicle_documents';
  const status = parsed.data.action === 'approve' ? 'approved' : 'rejected';
  const { data: document, error: updateError } = await supabaseAdmin
    .from(table)
    .update({
      status,
      rejection_reason: parsed.data.action === 'reject' ? parsed.data.reason : null,
      verified_by: owner.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.documentId)
    .select('id, status, rejection_reason, verified_at')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!document) return respond(404, { error: 'Document not found.' });

  return respond(200, { success: true, document });
}
