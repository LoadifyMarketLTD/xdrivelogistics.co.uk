import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { COMPANY_DRIVER_DOCUMENT_TYPES } from '../../_lib/onboarding';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../_lib/requireCompanyAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DRIVER_DOC_TYPES = new Set<string>(COMPANY_DRIVER_DOCUMENT_TYPES);
const VEHICLE_DOC_TYPES = new Set([
  'mot',
  'insurance',
  'road_tax',
  'operator_licence',
  'goods_vehicle_test',
  'other',
]);
const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type DocumentKind = 'driver' | 'vehicle';
type DbRow = Record<string, unknown>;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const text = (value: unknown, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const rows = (value: unknown): DbRow[] => Array.isArray(value) ? value as DbRow[] : [];

const validIsoDate = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const hasExpectedMagicBytes = (bytes: Buffer, mimeType: string) => {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
};

const safeFilenamePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

async function removeStorageObject(bucket: string, objectPath: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.storage.from(bucket).remove([objectPath]);
}

async function duplicateClearance(applicationId: string, sha256: string) {
  const { data, error } = await supabaseAdmin!
    .from('fraud_review_cases')
    .select('id')
    .eq('onboarding_application_id', applicationId)
    .eq('case_type', 'duplicate_file')
    .filter('evidence->>file_sha256', 'eq', sha256)
    .in('status', ['cleared', 'dismissed'])
    .limit(1)
    .maybeSingle();
  return { allowed: Boolean(data?.id), error };
}

async function registerDuplicateCase(params: {
  userId: string;
  companyId: string;
  applicationId: string;
  sha256: string;
  docType: string;
  fingerprint: DbRow;
}) {
  return supabaseAdmin!.rpc('register_duplicate_document_fraud_case', {
    p_subject_user_id: params.userId,
    p_subject_company_id: params.companyId,
    p_onboarding_application_id: params.applicationId,
    p_matched_user_id: params.fingerprint.user_id ?? null,
    p_matched_company_id: params.fingerprint.company_id ?? null,
    p_file_sha256: params.sha256,
    p_attempted_doc_type: params.docType,
    p_matched_fingerprint_id: params.fingerprint.id,
    p_matched_document_family: params.fingerprint.document_family ?? null,
    p_matched_document_id: params.fingerprint.document_id ?? null,
  });
}

function normalizedStatus(rawStatus: string, expiryDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (expiryDate && expiryDate < today) return 'expired';
  if (rawStatus === 'verified' || rawStatus === 'approved') return 'approved';
  if (rawStatus === 'rejected') return 'rejected';
  return 'pending';
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document service is temporarily unavailable.' });
  }

  const url = new URL(request.url);
  const companyId = text(url.searchParams.get('companyId'), 80);
  const kind = text(url.searchParams.get('kind'), 20) as DocumentKind;
  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;
  if (kind !== 'driver' && kind !== 'vehicle') return json(400, { error: 'Document kind must be driver or vehicle.' });

  if (kind === 'vehicle') {
    const { data: vehicleData, error: vehicleError } = await supabaseAdmin
      .from('vehicles')
      .select('id, reg_plate, registration')
      .eq('company_id', admin.companyId);
    if (vehicleError) return json(500, { error: 'Unable to load company vehicles.' });

    const vehicles = rows(vehicleData);
    const vehicleIds = vehicles.map((row) => text(row.id, 80)).filter(Boolean);
    if (vehicleIds.length === 0) return json(200, { rows: [] });

    const { data: documentData, error: documentError } = await supabaseAdmin
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, issued_date, expiry_date, status, created_at, file_path')
      .in('vehicle_id', vehicleIds)
      .order('created_at', { ascending: false });
    if (documentError) return json(500, { error: 'Unable to load vehicle compliance documents.' });

    const vehicleById = new Map(vehicles.map((row) => [text(row.id, 80), row]));
    return json(200, {
      rows: rows(documentData).map((document) => {
        const vehicle = vehicleById.get(text(document.vehicle_id, 80));
        const expiryDate = text(document.expiry_date, 10);
        return {
          id: text(document.id, 80),
          kind: 'vehicle',
          subject_id: text(document.vehicle_id, 80),
          subject_name: text(vehicle?.reg_plate) || text(vehicle?.registration) || 'Vehicle',
          doc_type: text(document.doc_type, 100),
          issued_date: text(document.issued_date, 10) || null,
          expiry_date: expiryDate || null,
          status: normalizedStatus(text(document.status, 30), expiryDate),
          review_status: text(document.status, 30) || 'pending',
          file_available: Boolean(text(document.file_path)),
          created_at: text(document.created_at, 50),
        };
      }),
    });
  }

  const { data: driverData, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, display_name')
    .eq('company_id', admin.companyId);
  if (driverError) return json(500, { error: 'Unable to load company drivers.' });

  const drivers = rows(driverData).filter((row) => Boolean(text(row.user_id, 80)));
  const userIds = drivers.map((row) => text(row.user_id, 80));
  if (userIds.length === 0) return json(200, { rows: [] });

  const { data: appData, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, company_id, account_type, created_at')
    .eq('company_id', admin.companyId)
    .eq('account_type', 'individual_driver')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });
  if (appError) return json(500, { error: 'Unable to load Driver onboarding applications.' });

  const latestAppByUser = new Map<string, DbRow>();
  for (const application of rows(appData)) {
    const userId = text(application.user_id, 80);
    if (userId && !latestAppByUser.has(userId)) latestAppByUser.set(userId, application);
  }
  const driverByApplication = new Map<string, DbRow>();
  for (const driver of drivers) {
    const application = latestAppByUser.get(text(driver.user_id, 80));
    if (application) driverByApplication.set(text(application.id, 80), driver);
  }
  const applicationIds = Array.from(driverByApplication.keys());
  if (applicationIds.length === 0) return json(200, { rows: [] });

  const { data: documentData, error: documentError } = await supabaseAdmin
    .from('driver_identity_documents')
    .select('id, onboarding_application_id, doc_type, issued_date, expiry_date, verification_status, created_at, file_path')
    .in('onboarding_application_id', applicationIds)
    .order('created_at', { ascending: false });
  if (documentError) return json(500, { error: 'Unable to load Driver identity documents.' });

  return json(200, {
    rows: rows(documentData).map((document) => {
      const driver = driverByApplication.get(text(document.onboarding_application_id, 80));
      const expiryDate = text(document.expiry_date, 10);
      return {
        id: text(document.id, 80),
        kind: 'driver',
        subject_id: text(driver?.id, 80),
        subject_name: text(driver?.display_name) || 'Driver',
        doc_type: text(document.doc_type, 100),
        issued_date: text(document.issued_date, 10) || null,
        expiry_date: expiryDate || null,
        status: normalizedStatus(text(document.verification_status, 30), expiryDate),
        review_status: text(document.verification_status, 30) || 'unverified',
        file_available: Boolean(text(document.file_path)),
        created_at: text(document.created_at, 50),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document service is temporarily unavailable.' });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const companyId = text(formData.get('companyId'), 80);
  const kind = text(formData.get('kind'), 20) as DocumentKind;
  const subjectId = text(formData.get('subjectId'), 80);
  const docType = text(formData.get('docType'), 100);
  const issuedDate = text(formData.get('issuedDate'), 10);
  const expiryDate = text(formData.get('expiryDate'), 10);

  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;
  if (!(file instanceof File)) return json(400, { error: 'Choose a document file.' });
  if (kind !== 'driver' && kind !== 'vehicle') return json(400, { error: 'Document kind must be driver or vehicle.' });
  if (!subjectId || !docType) return json(400, { error: 'Subject and document type are required.' });
  if (!validIsoDate(issuedDate) || !validIsoDate(expiryDate)) return json(400, { error: 'Issue and expiry dates must be valid dates.' });
  if (issuedDate && expiryDate && expiryDate < issuedDate) return json(400, { error: 'Expiry date cannot be before issue date.' });
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) return json(413, { error: 'File must be 10 MB or smaller.' });

  const extension = MIME_EXTENSION[file.type];
  if (!extension) return json(415, { error: 'Use a PDF, JPG, PNG or WEBP document.' });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedMagicBytes(bytes, file.type)) return json(415, { error: 'Document content does not match its file type.' });

  if (kind === 'vehicle') {
    if (!VEHICLE_DOC_TYPES.has(docType)) return json(400, { error: 'Choose a supported vehicle document type.' });
    if (['mot', 'insurance'].includes(docType) && !expiryDate) {
      return json(400, { error: 'MOT and Insurance require an expiry date for operational readiness.' });
    }

    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('vehicles')
      .select('id, company_id')
      .eq('id', subjectId)
      .eq('company_id', admin.companyId)
      .maybeSingle();
    if (vehicleError) return json(500, { error: 'Unable to verify Vehicle ownership.' });
    if (!vehicle) return json(404, { error: 'Vehicle not found for this company.' });

    const objectPath = `${admin.companyId}/${subjectId}/${Date.now()}-${safeFilenamePart(docType)}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from('vehicle-docs').upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return json(500, { error: uploadError.message });

    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const { data: document, error: documentError } = await supabaseAdmin
      .from('vehicle_documents')
      .insert({
        vehicle_id: subjectId,
        doc_type: docType,
        file_path: objectPath,
        issued_date: issuedDate || null,
        expiry_date: expiryDate || null,
        status: 'pending',
        uploaded_by: admin.userId,
        file_sha256: sha256,
      })
      .select('id, vehicle_id, doc_type, status, issued_date, expiry_date, created_at')
      .single();
    if (documentError) {
      await removeStorageObject('vehicle-docs', objectPath);
      return json(500, { error: 'Vehicle document record could not be created. Uploaded file was removed safely.' });
    }

    return json(201, { ok: true, document, review: 'pending_platform_owner_review' });
  }

  if (!DRIVER_DOC_TYPES.has(docType)) return json(400, { error: 'Choose a supported Company Driver identity document type.' });

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, company_id, display_name, phone')
    .eq('id', subjectId)
    .eq('company_id', admin.companyId)
    .maybeSingle();
  if (driverError) return json(500, { error: 'Unable to verify Driver ownership.' });
  if (!driver) return json(404, { error: 'Driver not found for this company.' });
  if (!driver.user_id) return json(409, { error: 'Driver account has no linked login identity yet.' });

  let { data: application, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, company_id, account_type, status, risk_status')
    .eq('user_id', driver.user_id)
    .eq('company_id', admin.companyId)
    .eq('account_type', 'individual_driver')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appError) return json(500, { error: 'Unable to resolve Driver onboarding.' });

  if (!application) {
    const ensured = await supabaseAdmin.rpc('ensure_company_driver_onboarding', {
      p_user_id: driver.user_id,
      p_company_id: admin.companyId,
      p_display_name: driver.display_name ?? null,
      p_phone: driver.phone ?? null,
    });
    if (ensured.error || !ensured.data) {
      return json(409, { error: ensured.error?.message ?? 'Company Driver onboarding could not be created.' });
    }
    const fetched = await supabaseAdmin
      .from('onboarding_applications')
      .select('id, user_id, company_id, account_type, status, risk_status')
      .eq('id', ensured.data)
      .maybeSingle();
    application = fetched.data;
    appError = fetched.error;
  }
  if (appError || !application) return json(500, { error: 'Driver onboarding application could not be loaded.' });
  if (application.account_type !== 'individual_driver') return json(409, { error: 'Driver identity is linked to a different onboarding account type.' });
  if (application.risk_status === 'confirmed_fraud') return json(403, { error: 'This Driver onboarding is blocked by compliance review.' });

  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const { data: fingerprint, error: fingerprintLookupError } = await supabaseAdmin
    .from('document_fingerprints')
    .select('id, onboarding_application_id, user_id, company_id, document_family, document_id')
    .eq('file_sha256', sha256)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fingerprintLookupError) return json(503, { error: 'Compliance fingerprint registry is unavailable.' });

  if (fingerprint) {
    if (fingerprint.onboarding_application_id === application.id) {
      return json(409, { error: 'This exact document is already uploaded for this Driver.' });
    }
    const clearance = await duplicateClearance(application.id, sha256);
    if (clearance.error) return json(503, { error: 'Duplicate-document clearance could not be verified.' });
    if (!clearance.allowed) {
      const duplicateCase = await registerDuplicateCase({
        userId: driver.user_id,
        companyId: admin.companyId,
        applicationId: application.id,
        sha256,
        docType,
        fingerprint,
      });
      if (duplicateCase.error) return json(500, { error: duplicateCase.error.message });
      return json(409, {
        error: 'Duplicate identity evidence detected. Driver onboarding is on hold for Platform Owner review.',
        code: 'duplicate_document_detected',
        reviewCaseId: duplicateCase.data ?? null,
      });
    }
  }

  const objectPath = `${driver.user_id}/${application.id}/${Date.now()}-${safeFilenamePart(docType)}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage.from('onboarding-documents').upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return json(500, { error: uploadError.message });

  const { data: document, error: documentError } = await supabaseAdmin
    .from('driver_identity_documents')
    .insert({
      onboarding_application_id: application.id,
      doc_type: docType,
      file_path: objectPath,
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      file_sha256: sha256,
      upload_status: 'uploaded',
      verification_status: 'unverified',
    })
    .select('id, onboarding_application_id, doc_type, verification_status, issued_date, expiry_date, created_at')
    .single();
  if (documentError) {
    await removeStorageObject('onboarding-documents', objectPath);
    return json(500, { error: 'Driver identity document record could not be created. Uploaded file was removed safely.' });
  }

  const { error: fingerprintError } = await supabaseAdmin.from('document_fingerprints').insert({
    document_family: 'identity',
    document_id: document.id,
    onboarding_application_id: application.id,
    user_id: driver.user_id,
    company_id: admin.companyId,
    file_sha256: sha256,
  });
  if (fingerprintError) {
    await supabaseAdmin.from('driver_identity_documents').delete().eq('id', document.id);
    await removeStorageObject('onboarding-documents', objectPath);
    return json(fingerprintError.code === '23505' ? 409 : 500, {
      error: fingerprintError.code === '23505'
        ? 'This exact identity document is already registered elsewhere and requires compliance review.'
        : 'Compliance fingerprint could not be stored. Upload was rolled back safely.',
    });
  }

  const onboardingUpdate: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  if (application.status !== 'approved') onboardingUpdate.status = 'in_progress';
  const { error: onboardingUpdateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update(onboardingUpdate)
    .eq('id', application.id);
  if (onboardingUpdateError) {
    await supabaseAdmin.from('document_fingerprints').delete().eq('document_id', document.id);
    await supabaseAdmin.from('driver_identity_documents').delete().eq('id', document.id);
    await removeStorageObject('onboarding-documents', objectPath);
    return json(500, { error: 'Driver onboarding could not be updated. Upload was rolled back safely.' });
  }

  return json(201, {
    ok: true,
    document,
    onboardingApplicationId: application.id,
    review: 'pending_platform_owner_review',
  });
}
