import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const documentFamilySchema = z.enum(['driver', 'vehicle', 'company', 'identity']);
type DocumentFamily = z.infer<typeof documentFamilySchema>;

const documentActionSchema = z.object({
  documentFamily: documentFamilySchema,
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(5000).optional(),
});

const documentViewSchema = z.object({
  documentFamily: documentFamilySchema,
  id: z.string().uuid(),
});

type PlatformOwner = { id: string };

type DocumentRow = {
  id: string;
  document_family: DocumentFamily;
  entity_type: 'driver' | 'vehicle' | 'company' | 'identity';
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  created_at: string;
  is_expired: boolean;
  file_available: boolean;
};

const verifyPlatformOwner = async (request: NextRequest): Promise<PlatformOwner | null> => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;

  const token = getBearerToken(request);
  if (!token) return null;

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'owner') return null;
  return { id: authData.user.id };
};

const asPayloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const resolveStorageObject = (
  rawPath: string,
  fallbackBucket: string,
): { bucket: string; objectPath: string } | null => {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return { bucket: fallbackBucket, objectPath: trimmed.replace(/^\/+/, '') };
  }

  try {
    const url = new URL(trimmed);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const suffix = url.pathname.slice(markerIndex + marker.length);
    const parts = suffix.split('/').filter(Boolean);
    if (parts.length < 3) return null;

    const accessMode = parts.shift();
    if (!['sign', 'public', 'authenticated'].includes(accessMode ?? '')) return null;

    const bucket = decodeURIComponent(parts.shift() ?? '');
    const objectPath = parts.map((part) => decodeURIComponent(part)).join('/');
    if (!bucket || !objectPath) return null;

    return { bucket, objectPath };
  } catch {
    return null;
  }
};

const documentSource = (family: DocumentFamily) => {
  switch (family) {
    case 'driver':
      return {
        table: 'driver_documents',
        bucket: 'driver-docs',
        statusColumn: 'status',
        approvedValue: 'approved',
        rejectedValue: 'rejected',
        verifiedByColumn: 'verified_by',
        verifiedAtColumn: 'verified_at',
        rejectionColumn: 'rejection_reason',
      } as const;
    case 'vehicle':
      return {
        table: 'vehicle_documents',
        bucket: 'vehicle-docs',
        statusColumn: 'status',
        approvedValue: 'approved',
        rejectedValue: 'rejected',
        verifiedByColumn: 'verified_by',
        verifiedAtColumn: 'verified_at',
        rejectionColumn: 'rejection_reason',
      } as const;
    case 'company':
      return {
        table: 'company_documents',
        bucket: 'onboarding-documents',
        statusColumn: 'status',
        approvedValue: 'approved',
        rejectedValue: 'rejected',
        verifiedByColumn: 'reviewed_by',
        verifiedAtColumn: 'reviewed_at',
        rejectionColumn: 'review_notes',
      } as const;
    case 'identity':
      return {
        table: 'driver_identity_documents',
        bucket: 'onboarding-documents',
        statusColumn: 'verification_status',
        approvedValue: 'verified',
        rejectedValue: 'rejected',
        verifiedByColumn: 'reviewed_by',
        verifiedAtColumn: 'reviewed_at',
        rejectionColumn: 'review_notes',
      } as const;
  }
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 250) || 250, 500);

  const [driverDocsResult, vehicleDocsResult, companyDocsResult, identityDocsResult] = await Promise.all([
    supabaseAdmin
      .from('driver_documents')
      .select('id, driver_id, doc_type, status, expiry_date, issued_date, created_at, file_path')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, status, expiry_date, issued_date, created_at, file_path')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('company_documents')
      .select('id, company_id, onboarding_application_id, doc_type, status, expiry_date, created_at, file_path')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('driver_identity_documents')
      .select('id, onboarding_application_id, doc_type, verification_status, expiry_date, created_at, file_path')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const firstError = [
    driverDocsResult.error,
    vehicleDocsResult.error,
    companyDocsResult.error,
    identityDocsResult.error,
  ].find(Boolean);
  if (firstError) return respond(500, { error: firstError.message });

  const driverDocs = driverDocsResult.data ?? [];
  const vehicleDocs = vehicleDocsResult.data ?? [];
  const companyDocs = companyDocsResult.data ?? [];
  const identityDocs = identityDocsResult.data ?? [];

  const driverIds = Array.from(new Set(driverDocs.map((row) => row.driver_id as string).filter(Boolean)));
  const vehicleIds = Array.from(new Set(vehicleDocs.map((row) => row.vehicle_id as string).filter(Boolean)));
  const onboardingIds = Array.from(
    new Set(
      [
        ...companyDocs.map((row) => row.onboarding_application_id as string),
        ...identityDocs.map((row) => row.onboarding_application_id as string),
      ].filter(Boolean),
    ),
  );

  const [driversResult, vehiclesResult, onboardingResult] = await Promise.all([
    driverIds.length
      ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? supabaseAdmin.from('vehicles').select('id, registration, company_id').in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null }),
    onboardingIds.length
      ? supabaseAdmin
          .from('onboarding_applications')
          .select('id, email, account_type, company_id, payload')
          .in('id', onboardingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relatedError = [driversResult.error, vehiclesResult.error, onboardingResult.error].find(Boolean);
  if (relatedError) return respond(500, { error: relatedError.message });

  const driverById = new Map(
    (driversResult.data ?? []).map((row) => [row.id as string, row as { id: string; display_name: string | null; company_id: string | null }]),
  );
  const vehicleById = new Map(
    (vehiclesResult.data ?? []).map((row) => [row.id as string, row as { id: string; registration: string | null; company_id: string | null }]),
  );
  const onboardingById = new Map(
    (onboardingResult.data ?? []).map((row) => [
      row.id as string,
      row as {
        id: string;
        email: string | null;
        account_type: string | null;
        company_id: string | null;
        payload: unknown;
      },
    ]),
  );

  const companyIds = Array.from(
    new Set(
      [
        ...Array.from(driverById.values()).map((row) => row.company_id),
        ...Array.from(vehicleById.values()).map((row) => row.company_id),
        ...companyDocs.map((row) => row.company_id as string | null),
        ...Array.from(onboardingById.values()).map((row) => row.company_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const companiesResult = companyIds.length
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [], error: null };
  if (companiesResult.error) return respond(500, { error: companiesResult.error.message });

  const companyNameById = new Map(
    (companiesResult.data ?? []).map((row) => [row.id as string, String(row.name ?? 'Unknown Company')]),
  );
  const today = new Date().toISOString().slice(0, 10);

  const rows: DocumentRow[] = [];

  for (const document of driverDocs) {
    const driver = driverById.get(document.driver_id as string);
    const companyId = driver?.company_id ?? null;
    const expiryDate = (document.expiry_date as string | null) ?? null;
    rows.push({
      id: document.id as string,
      document_family: 'driver',
      entity_type: 'driver',
      entity_name: driver?.display_name ?? 'Unknown Driver',
      company_name: companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Independent',
      doc_type: String(document.doc_type ?? 'Document'),
      status: String(document.status ?? 'pending'),
      expiry_date: expiryDate,
      issued_date: (document.issued_date as string | null) ?? null,
      created_at: String(document.created_at ?? ''),
      is_expired: Boolean(expiryDate && expiryDate < today),
      file_available: Boolean(document.file_path),
    });
  }

  for (const document of vehicleDocs) {
    const vehicle = vehicleById.get(document.vehicle_id as string);
    const companyId = vehicle?.company_id ?? null;
    const expiryDate = (document.expiry_date as string | null) ?? null;
    rows.push({
      id: document.id as string,
      document_family: 'vehicle',
      entity_type: 'vehicle',
      entity_name: vehicle?.registration ?? 'Unknown Vehicle',
      company_name: companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Unknown Company',
      doc_type: String(document.doc_type ?? 'Document'),
      status: String(document.status ?? 'pending'),
      expiry_date: expiryDate,
      issued_date: (document.issued_date as string | null) ?? null,
      created_at: String(document.created_at ?? ''),
      is_expired: Boolean(expiryDate && expiryDate < today),
      file_available: Boolean(document.file_path),
    });
  }

  for (const document of companyDocs) {
    const companyId = (document.company_id as string | null) ?? null;
    const expiryDate = (document.expiry_date as string | null) ?? null;
    rows.push({
      id: document.id as string,
      document_family: 'company',
      entity_type: 'company',
      entity_name: companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Unknown Company',
      company_name: companyId ? companyNameById.get(companyId) ?? 'Unknown Company' : 'Unknown Company',
      doc_type: String(document.doc_type ?? 'Document'),
      status: String(document.status ?? 'pending'),
      expiry_date: expiryDate,
      issued_date: null,
      created_at: String(document.created_at ?? ''),
      is_expired: Boolean(expiryDate && expiryDate < today),
      file_available: Boolean(document.file_path),
    });
  }

  for (const document of identityDocs) {
    const onboarding = onboardingById.get(document.onboarding_application_id as string);
    const payload = asPayloadRecord(onboarding?.payload);
    const entityName =
      readText(payload.full_name) ??
      readText(payload.contact_person) ??
      onboarding?.email ??
      'Unknown Applicant';
    const companyId = onboarding?.company_id ?? null;
    const expiryDate = (document.expiry_date as string | null) ?? null;
    rows.push({
      id: document.id as string,
      document_family: 'identity',
      entity_type: 'identity',
      entity_name: entityName,
      company_name: companyId
        ? companyNameById.get(companyId) ?? 'Unknown Company'
        : onboarding?.account_type === 'owner_driver' || onboarding?.account_type === 'individual_driver'
          ? 'Independent / Owner Driver'
          : 'Not linked',
      doc_type: String(document.doc_type ?? 'Document'),
      status: String(document.verification_status ?? 'unverified'),
      expiry_date: expiryDate,
      issued_date: null,
      created_at: String(document.created_at ?? ''),
      is_expired: Boolean(expiryDate && expiryDate < today),
      file_available: Boolean(document.file_path),
    });
  }

  rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
  const limitedRows = rows.slice(0, limit);

  return respond(200, {
    rows: limitedRows,
    summary: {
      total: limitedRows.length,
      approved: limitedRows.filter((row) => ['approved', 'verified'].includes(row.status)).length,
      pending: limitedRows.filter((row) => ['pending', 'under_review', 'unverified'].includes(row.status)).length,
      rejected: limitedRows.filter((row) => row.status === 'rejected').length,
      expired: limitedRows.filter((row) => row.is_expired).length,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const body = await request.json().catch(() => null);
  const parsed = documentViewSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid document view request.' });

  const source = documentSource(parsed.data.documentFamily);
  const { data: document, error: documentError } = await supabaseAdmin
    .from(source.table)
    .select('id, file_path')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (documentError) return respond(500, { error: documentError.message });
  if (!document) return respond(404, { error: 'Document not found.' });

  const rawPath = readText(document.file_path);
  if (!rawPath) return respond(409, { error: 'This document has no stored file.' });

  const storageObject = resolveStorageObject(rawPath, source.bucket);
  if (!storageObject) {
    return respond(409, { error: 'Stored document path is not a supported private-storage object.' });
  }

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from(storageObject.bucket)
    .createSignedUrl(storageObject.objectPath, 300);

  if (signedError || !signed?.signedUrl) {
    return respond(500, { error: signedError?.message ?? 'Failed to create secure document link.' });
  }

  await supabaseAdmin.from('owner_audit_log').insert({
    actor_user_id: owner.id,
    target_company_id: null,
    action_type: 'document_viewed',
    old_status: '',
    new_status: '',
    reason: `Platform owner opened ${parsed.data.documentFamily} document ${parsed.data.id}.`,
    metadata: {
      document_id: parsed.data.id,
      document_family: parsed.data.documentFamily,
    },
  });

  return respond(200, { url: signed.signedUrl, expiresInSeconds: 300 });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const body = await request.json().catch(() => null);
  const parsed = documentActionSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid document review request.' });

  const source = documentSource(parsed.data.documentFamily);
  const { data: currentDocument, error: currentError } = await supabaseAdmin
    .from(source.table)
    .select(`id, ${source.statusColumn}`)
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (currentError) return respond(500, { error: currentError.message });
  if (!currentDocument) return respond(404, { error: 'Document not found.' });

  const nextStatus = parsed.data.action === 'approve' ? source.approvedValue : source.rejectedValue;
  const payload: Record<string, unknown> = {
    [source.statusColumn]: nextStatus,
    [source.verifiedByColumn]: owner.id,
    [source.verifiedAtColumn]: new Date().toISOString(),
    [source.rejectionColumn]:
      parsed.data.action === 'reject'
        ? parsed.data.reason?.trim() || 'Rejected by platform compliance review.'
        : null,
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from(source.table)
    .update(payload)
    .eq('id', parsed.data.id)
    .select(`id, ${source.statusColumn}`)
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });

  const oldStatus = readText(currentDocument[source.statusColumn]) ?? '';
  await supabaseAdmin.from('owner_audit_log').insert({
    actor_user_id: owner.id,
    target_company_id: null,
    action_type: parsed.data.action === 'approve' ? 'document_approved' : 'document_rejected',
    old_status: oldStatus,
    new_status: nextStatus,
    reason:
      parsed.data.reason?.trim() ||
      `${parsed.data.documentFamily} document ${parsed.data.id} ${nextStatus} by platform compliance.`,
    metadata: {
      document_id: parsed.data.id,
      document_family: parsed.data.documentFamily,
    },
  });

  return respond(200, {
    document: updated,
    documentFamily: parsed.data.documentFamily,
    status: nextStatus,
  });
}
