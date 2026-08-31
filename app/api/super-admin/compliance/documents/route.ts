import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag, getGlobalSettingNumber } from '../../../_lib/platformFlags';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const familySchema = z.enum(['driver', 'vehicle', 'company', 'identity']);
type DocumentFamily = z.infer<typeof familySchema>;
type InspectorEntityType = 'driver' | 'vehicle' | 'company' | 'user';
type DbRow = Record<string, unknown>;

type DocumentRow = {
  id: string;
  document_family: DocumentFamily;
  entity_type: DocumentFamily;
  entity_name: string;
  company_name: string;
  inspector_entity_type: InspectorEntityType | null;
  inspector_entity_id: string | null;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  created_at: string;
  is_expired: boolean;
  file_available: boolean;
};

const viewSchema = z.object({
  documentFamily: familySchema,
  id: z.string().uuid(),
});

const reviewSchema = viewSchema.extend({
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

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const nullableText = (value: unknown): string | null => {
  const resolved = text(value);
  return resolved || null;
};

const objectValue = (value: unknown): DbRow =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as DbRow) : {};

const rows = (value: unknown): DbRow[] =>
  Array.isArray(value) ? (value as DbRow[]) : [];

const sourceFor = (family: DocumentFamily) => {
  if (family === 'driver') {
    return { table: 'driver_documents', bucket: 'driver-docs' } as const;
  }
  if (family === 'vehicle') {
    return { table: 'vehicle_documents', bucket: 'vehicle-docs' } as const;
  }
  if (family === 'company') {
    return { table: 'company_documents', bucket: 'onboarding-documents' } as const;
  }
  return { table: 'driver_identity_documents', bucket: 'onboarding-documents' } as const;
};

const auditTargetTypeFor = (family: DocumentFamily) => `${family}_document`;
const auditTargetNameFor = (family: DocumentFamily, docType: unknown, documentId: string) => {
  const resolvedType = text(docType);
  return resolvedType || `${family} document ${documentId}`;
};

const resolveStorageObject = (
  rawPath: string,
  fallbackBucket: string,
): { bucket: string; objectPath: string } | null => {
  const value = rawPath.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return { bucket: fallbackBucket, objectPath: value.replace(/^\/+/, '') };
  }

  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const parts = url.pathname.slice(markerIndex + marker.length).split('/').filter(Boolean);
    if (parts.length < 3) return null;
    const accessMode = parts.shift();
    if (!['sign', 'public', 'authenticated'].includes(accessMode ?? '')) return null;
    const bucket = decodeURIComponent(parts.shift() ?? '');
    const objectPath = parts.map((part) => decodeURIComponent(part)).join('/');
    if (!bucket || bucket !== fallbackBucket || !objectPath) return null;
    return { bucket: fallbackBucket, objectPath };
  } catch {
    return null;
  }
};

const fetchVehicleOwners = async (vehicleIds: string[]) => {
  if (!supabaseAdmin || vehicleIds.length === 0) return { data: [] as DbRow[], error: null };

  const primary = await supabaseAdmin
    .from('vehicles')
    .select('id, registration, company_id')
    .in('id', vehicleIds);
  if (!primary.error) return { data: rows(primary.data), error: null };
  if (primary.error.code !== '42703') return { data: [] as DbRow[], error: primary.error };

  const legacy = await supabaseAdmin
    .from('vehicles')
    .select('id, reg_plate, company_id')
    .in('id', vehicleIds);
  return { data: rows(legacy.data), error: legacy.error };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') ?? 250) || 250, 500);

  const [driverResult, vehicleResult, companyResult, identityResult] = await Promise.all([
    supabaseAdmin.from('driver_documents').select('id, driver_id, doc_type, status, expiry_date, issued_date, created_at, file_path').order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('vehicle_documents').select('id, vehicle_id, doc_type, status, expiry_date, issued_date, created_at, file_path').order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('company_documents').select('id, company_id, onboarding_application_id, doc_type, status, expiry_date, issued_date, created_at, file_path').order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('driver_identity_documents').select('id, onboarding_application_id, doc_type, verification_status, expiry_date, issued_date, created_at, file_path').order('created_at', { ascending: false }).limit(limit),
  ]);

  const sourceError = [driverResult.error, vehicleResult.error, companyResult.error, identityResult.error].find(Boolean);
  if (sourceError) return respond(500, { error: sourceError.message });

  const driverDocuments = rows(driverResult.data);
  const vehicleDocuments = rows(vehicleResult.data);
  const companyDocuments = rows(companyResult.data);
  const identityDocuments = rows(identityResult.data);

  const driverIds = Array.from(new Set(driverDocuments.map((row) => text(row.driver_id)).filter(Boolean)));
  const vehicleIds = Array.from(new Set(vehicleDocuments.map((row) => text(row.vehicle_id)).filter(Boolean)));
  const applicationIds = Array.from(new Set([...companyDocuments, ...identityDocuments].map((row) => text(row.onboarding_application_id)).filter(Boolean)));

  const [driversResult, vehiclesResult, applicationsResult] = await Promise.all([
    driverIds.length
      ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    fetchVehicleOwners(vehicleIds),
    applicationIds.length
      ? supabaseAdmin.from('onboarding_applications').select('id, user_id, email, account_type, company_id, payload').in('id', applicationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relatedError = [driversResult.error, vehiclesResult.error, applicationsResult.error].find(Boolean);
  if (relatedError) return respond(500, { error: relatedError.message });

  const driverById = new Map(rows(driversResult.data).map((row) => [text(row.id), row]));
  const vehicleById = new Map(vehiclesResult.data.map((row) => [text(row.id), row]));
  const applicationById = new Map(rows(applicationsResult.data).map((row) => [text(row.id), row]));

  const companyIds = Array.from(new Set([
    ...Array.from(driverById.values()).map((row) => text(row.company_id)),
    ...Array.from(vehicleById.values()).map((row) => text(row.company_id)),
    ...companyDocuments.map((row) => text(row.company_id)),
    ...Array.from(applicationById.values()).map((row) => text(row.company_id)),
  ].filter(Boolean)));

  const companyResultRows = companyIds.length
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [], error: null };
  if (companyResultRows.error) return respond(500, { error: companyResultRows.error.message });

  const companyNameById = new Map(rows(companyResultRows.data).map((row) => [text(row.id), text(row.name, 'Unknown Company')]));
  const expiryWarningDays = await getGlobalSettingNumber(supabaseAdmin, 'doc_expiry_warning_days');
  const warningThresholdDate = new Date();
  warningThresholdDate.setDate(warningThresholdDate.getDate() + expiryWarningDays);
  const warningThreshold = warningThresholdDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const output: DocumentRow[] = [];

  for (const document of driverDocuments) {
    const driverId = text(document.driver_id);
    const driver = driverById.get(driverId);
    const companyId = text(driver?.company_id);
    const expiryDate = nullableText(document.expiry_date);
    output.push({
      id: text(document.id), document_family: 'driver', entity_type: 'driver',
      entity_name: text(driver?.display_name, 'Unknown Driver'),
      company_name: companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Independent',
      inspector_entity_type: driverId ? 'driver' : null, inspector_entity_id: driverId || null,
      doc_type: text(document.doc_type, 'Document'), status: text(document.status, 'pending'),
      expiry_date: expiryDate, issued_date: nullableText(document.issued_date), created_at: text(document.created_at),
      is_expired: Boolean(expiryDate && expiryDate < today), file_available: Boolean(nullableText(document.file_path)),
    });
  }

  for (const document of vehicleDocuments) {
    const vehicleId = text(document.vehicle_id);
    const vehicle = vehicleById.get(vehicleId);
    const companyId = text(vehicle?.company_id);
    const expiryDate = nullableText(document.expiry_date);
    output.push({
      id: text(document.id), document_family: 'vehicle', entity_type: 'vehicle',
      entity_name: text(vehicle?.registration) || text(vehicle?.reg_plate, 'Unknown Vehicle'),
      company_name: companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Unknown Company',
      inspector_entity_type: vehicleId ? 'vehicle' : null, inspector_entity_id: vehicleId || null,
      doc_type: text(document.doc_type, 'Document'), status: text(document.status, 'pending'),
      expiry_date: expiryDate, issued_date: nullableText(document.issued_date), created_at: text(document.created_at),
      is_expired: Boolean(expiryDate && expiryDate < today), file_available: Boolean(nullableText(document.file_path)),
    });
  }

  for (const document of companyDocuments) {
    const companyId = text(document.company_id);
    const expiryDate = nullableText(document.expiry_date);
    const companyName = companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Unknown Company';
    output.push({
      id: text(document.id), document_family: 'company', entity_type: 'company', entity_name: companyName, company_name: companyName,
      inspector_entity_type: companyId ? 'company' : null, inspector_entity_id: companyId || null,
      doc_type: text(document.doc_type, 'Document'), status: text(document.status, 'pending'),
      expiry_date: expiryDate, issued_date: nullableText(document.issued_date), created_at: text(document.created_at),
      is_expired: Boolean(expiryDate && expiryDate < today), file_available: Boolean(nullableText(document.file_path)),
    });
  }

  for (const document of identityDocuments) {
    const application = applicationById.get(text(document.onboarding_application_id));
    const payload = objectValue(application?.payload);
    const companyId = text(application?.company_id);
    const userId = text(application?.user_id);
    const accountType = text(application?.account_type);
    const expiryDate = nullableText(document.expiry_date);
    const inspectorType: InspectorEntityType | null = userId ? 'user' : companyId ? 'company' : null;
    const inspectorId = userId || companyId || null;
    output.push({
      id: text(document.id), document_family: 'identity', entity_type: 'identity',
      entity_name: text(payload.full_name) || text(payload.contact_person) || text(application?.email, 'Unknown Applicant'),
      company_name: companyId
        ? companyNameById.get(companyId) ?? 'Unknown Company'
        : ['owner_driver', 'individual_driver'].includes(accountType) ? 'Independent / Owner Driver' : 'Not linked',
      inspector_entity_type: inspectorType, inspector_entity_id: inspectorId,
      doc_type: text(document.doc_type, 'Document'), status: text(document.verification_status, 'unverified'),
      expiry_date: expiryDate, issued_date: nullableText(document.issued_date), created_at: text(document.created_at),
      is_expired: Boolean(expiryDate && expiryDate < today), file_available: Boolean(nullableText(document.file_path)),
    });
  }

  output.sort((left, right) => right.created_at.localeCompare(left.created_at));
  const limitedRows = output.slice(0, limit);

  return respond(200, {
    rows: limitedRows,
    summary: {
      total: limitedRows.length,
      approved: limitedRows.filter((row) => ['approved', 'verified'].includes(row.status)).length,
      pending: limitedRows.filter((row) => ['pending', 'under_review', 'unverified'].includes(row.status)).length,
      rejected: limitedRows.filter((row) => row.status === 'rejected').length,
      expired: limitedRows.filter((row) => row.is_expired).length,
      expiring_soon: limitedRows.filter((row) => !row.is_expired && row.expiry_date !== null && row.expiry_date > today && row.expiry_date <= warningThreshold).length,
      expiry_warning_days: expiryWarningDays,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const parsed = viewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid document view request.' });

  const source = sourceFor(parsed.data.documentFamily);
  const { data, error } = await supabaseAdmin.from(source.table).select('id, doc_type, file_path').eq('id', parsed.data.id).maybeSingle();
  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Document not found.' });

  const filePath = nullableText((data as DbRow).file_path);
  if (!filePath) return respond(409, { error: 'This document has no stored file.' });
  const storageObject = resolveStorageObject(filePath, source.bucket);
  if (!storageObject) return respond(409, { error: 'Stored document path is not a supported private-storage object.' });
  if (storageObject.bucket !== source.bucket) return respond(409, { error: 'Stored document path does not match the expected document storage bucket.' });

  const { data: signed, error: signedError } = await supabaseAdmin.storage.from(source.bucket).createSignedUrl(storageObject.objectPath, 300);
  if (signedError || !signed?.signedUrl) return respond(500, { error: signedError?.message ?? 'Failed to create secure document link.' });

  const { error: auditError } = await supabaseAdmin.from('owner_audit_log').insert({
    actor_user_id: owner.id,
    target_type: auditTargetTypeFor(parsed.data.documentFamily),
    target_id: parsed.data.id,
    target_name: auditTargetNameFor(parsed.data.documentFamily, (data as DbRow).doc_type, parsed.data.id),
    target_company_id: null,
    action_type: 'document_viewed', old_status: '', new_status: '',
    reason: `Platform owner opened ${parsed.data.documentFamily} document ${parsed.data.id}.`,
    metadata: { document_id: parsed.data.id, document_family: parsed.data.documentFamily, target_type: auditTargetTypeFor(parsed.data.documentFamily) },
  });
  if (auditError) return respond(500, { error: auditError.message });

  return respond(200, { url: signed.signedUrl, expiresInSeconds: 300 });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const documentReviewEnabled = await getFeatureFlag(supabaseAdmin, 'document_review');
  if (!documentReviewEnabled) return respond(503, { error: 'Document review is currently disabled via feature flags.' });

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid document review request.', details: parsed.error.flatten() });

  const { data: result, error: reviewError } = await supabaseAdmin.rpc('owner_review_compliance_document', {
    p_actor_user_id: owner.id,
    p_document_family: parsed.data.documentFamily,
    p_document_id: parsed.data.id,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason?.trim() || null,
  });

  if (reviewError) {
    if (reviewError.code === 'P0002') return respond(404, { error: 'Document not found.' });
    if (reviewError.code === '42501') return respond(403, { error: reviewError.message });
    if (reviewError.code === '23505') return respond(409, { error: reviewError.message });
    if (reviewError.code === '23514') return respond(422, { error: reviewError.message });
    if (reviewError.code === 'PGRST202' || reviewError.code === '42883') return respond(503, { error: 'Canonical compliance review RPC is not available in this environment.' });
    return respond(500, { error: reviewError.message });
  }

  const row = Array.isArray(result) ? (result[0] as DbRow | undefined) : (result as DbRow | null);
  return respond(200, { document: row ?? null, documentFamily: parsed.data.documentFamily, status: text(row?.new_status) });
}
