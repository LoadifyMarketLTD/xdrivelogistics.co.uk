import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const DRIVER_DOC_TYPES = new Set([
  'Driving Licence',
  'Proof of Address',
  'Right to Work',
  'DBS Certificate',
  'CPC Card',
  'Tacho Card',
  'Medical Certificate',
  'Visa Document',
  'Other',
]);
const VEHICLE_DOC_TYPES = new Set([
  'MOT',
  'Insurance',
  'Goods Vehicle Test',
  'Other',
]);

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const clean = (value: unknown, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 180) || 'document';
}

function hasExpectedMagicBytes(bytes: Buffer, mimeType: string) {
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
}

function normalizeDriverDocsObjectPath(value: unknown) {
  const raw = clean(value, 4000);
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '');

  try {
    const url = new URL(raw);
    const markers = [
      '/storage/v1/object/sign/driver-docs/',
      '/storage/v1/object/public/driver-docs/',
      '/storage/v1/object/authenticated/driver-docs/',
    ];
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index < 0) continue;
      const encoded = url.pathname.slice(index + marker.length);
      return decodeURIComponent(encoded).replace(/^\/+/, '') || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveContext(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Document services are temporarily unavailable.' }) } as const;
  }

  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Your session has expired. Sign in again.' }) } as const;

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Your session has expired. Sign in again.' }) } as const;
  }

  const [{ data: driver, error: driverError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id,user_id,company_id,status,is_active,app_access,driver_type')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('status')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (driverError || profileError) {
    return { error: json(500, { error: 'Your Driver document profile could not be verified.' }) } as const;
  }
  if (!driver?.id || !driver.company_id) {
    return { error: json(403, { error: 'A company-linked Driver profile is required.' }) } as const;
  }

  const driverStatus = String(driver.status ?? '').trim().toLowerCase();
  const profileStatus = String(profile?.status ?? '').trim().toLowerCase();
  if (driverStatus !== 'active' || driver.is_active === false || profileStatus !== 'active') {
    return { error: json(403, { error: 'An active Driver profile is required for document management.' }) } as const;
  }

  const [{ data: company, error: companyError }, { data: membership, error: membershipError }] = await Promise.all([
    supabaseAdmin.from('companies').select('id,status').eq('id', driver.company_id).maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('role_in_company,status')
      .eq('company_id', driver.company_id)
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);
  if (companyError || membershipError) {
    return { error: json(500, { error: 'Your company document permissions could not be verified.' }) } as const;
  }

  const companyStatus = String(company?.status ?? '').trim().toLowerCase();
  if (!['active', 'approved'].includes(companyStatus) || membership?.status !== 'active') {
    return { error: json(403, { error: 'An active company membership is required for document management.' }) } as const;
  }

  const membershipRole = String(membership.role_in_company ?? '').trim().toLowerCase();
  return {
    userId: authData.user.id,
    driverId: String(driver.id),
    companyId: String(driver.company_id),
    driverType: typeof driver.driver_type === 'string' ? driver.driver_type : null,
    appAccess: driver.app_access === true,
    membershipRole,
    canManageCompanyVehicles: membershipRole === 'owner' || membershipRole === 'admin',
  } as const;
}

async function signedUrlFor(filePath: unknown) {
  const objectPath = normalizeDriverDocsObjectPath(filePath);
  if (!objectPath) return { objectPath: null, signedUrl: null, available: false };
  const { data, error } = await supabaseAdmin!.storage.from('driver-docs').createSignedUrl(objectPath, 3600);
  return {
    objectPath,
    signedUrl: error ? null : data?.signedUrl ?? null,
    available: !error && Boolean(data?.signedUrl),
  };
}

type VehicleRow = {
  id: string;
  reg_plate: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
  assigned_driver_id: string | null;
};

function vehicleLabel(vehicle: VehicleRow) {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return [vehicle.reg_plate, name].filter(Boolean).join(' · ') || `Vehicle ${vehicle.id.slice(0, 8).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const context = await resolveContext(request);
  if ('error' in context) return context.error;

  const admin = supabaseAdmin!;
  let vehiclesQuery = admin
    .from('vehicles')
    .select('id,reg_plate,make,model,status,assigned_driver_id')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (!context.canManageCompanyVehicles) vehiclesQuery = vehiclesQuery.eq('assigned_driver_id', context.driverId);

  const [driverDocsResult, vehiclesResult] = await Promise.all([
    admin
      .from('driver_documents')
      .select('id,doc_type,file_path,issued_date,expiry_date,status,rejection_reason,created_at')
      .eq('driver_id', context.driverId)
      .order('created_at', { ascending: false }),
    vehiclesQuery,
  ]);

  if (driverDocsResult.error || vehiclesResult.error) {
    return json(500, { error: 'Your document register could not be loaded.' });
  }

  const vehicles = (vehiclesResult.data ?? []) as VehicleRow[];
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const vehicleDocsResult = vehicleIds.length
    ? await admin
        .from('vehicle_documents')
        .select('id,vehicle_id,doc_type,document_name,file_path,document_url,issued_date,expiry_date,status,rejection_reason,created_at,uploaded_at')
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };

  if (vehicleDocsResult.error) return json(500, { error: 'Vehicle documents could not be loaded.' });

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driverDocuments = await Promise.all((driverDocsResult.data ?? []).map(async (document) => {
    const file = await signedUrlFor(document.file_path);
    return {
      id: String(document.id),
      scope: 'driver' as const,
      doc_type: String(document.doc_type ?? 'Document'),
      vehicle_id: null,
      vehicle_label: null,
      issued_date: document.issued_date ?? null,
      expiry_date: document.expiry_date ?? null,
      status: String(document.status ?? 'pending'),
      rejection_reason: document.rejection_reason ?? null,
      created_at: document.created_at ?? null,
      file_available: file.available,
      signed_url: file.signedUrl,
      legacy_path_normalized: Boolean(document.file_path && file.objectPath && document.file_path !== file.objectPath),
    };
  }));

  const vehicleDocuments = await Promise.all((vehicleDocsResult.data ?? []).map(async (document) => {
    const sourcePath = document.file_path ?? document.document_url;
    const file = await signedUrlFor(sourcePath);
    const vehicle = vehicleById.get(String(document.vehicle_id));
    return {
      id: String(document.id),
      scope: 'vehicle' as const,
      doc_type: String(document.doc_type ?? document.document_name ?? 'Vehicle document'),
      vehicle_id: String(document.vehicle_id),
      vehicle_label: vehicle ? vehicleLabel(vehicle) : 'Vehicle',
      issued_date: document.issued_date ?? null,
      expiry_date: document.expiry_date ?? null,
      status: String(document.status ?? 'pending'),
      rejection_reason: document.rejection_reason ?? null,
      created_at: document.created_at ?? document.uploaded_at ?? null,
      file_available: file.available,
      signed_url: file.signedUrl,
      legacy_path_normalized: Boolean(sourcePath && file.objectPath && sourcePath !== file.objectPath),
    };
  }));

  return json(200, {
    documents: [...driverDocuments, ...vehicleDocuments].sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
    ),
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: vehicleLabel(vehicle),
      status: vehicle.status,
      assigned_to_me: vehicle.assigned_driver_id === context.driverId,
      assigned_to_other_driver: Boolean(vehicle.assigned_driver_id && vehicle.assigned_driver_id !== context.driverId),
    })),
    driver: {
      id: context.driverId,
      company_id: context.companyId,
      driver_type: context.driverType,
      app_access: context.appAccess,
      membership_role: context.membershipRole,
      can_manage_company_vehicles: context.canManageCompanyVehicles,
    },
  });
}

export async function POST(request: NextRequest) {
  const context = await resolveContext(request);
  if ('error' in context) return context.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { error: 'The upload request is invalid.' });
  }

  const scope = clean(formData.get('scope'), 20).toLowerCase();
  const docType = clean(formData.get('docType'), 100);
  const vehicleId = clean(formData.get('vehicleId'), 80);
  const issuedDate = clean(formData.get('issuedDate'), 20) || null;
  const expiryDate = clean(formData.get('expiryDate'), 20) || null;
  const file = formData.get('file');

  if (scope !== 'driver' && scope !== 'vehicle') return json(400, { error: 'Choose Driver or Vehicle document.' });
  if (!(file instanceof File)) return json(400, { error: 'Select a document to upload.' });
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return json(413, { error: 'Document must be between 1 byte and 10 MB.' });
  if (!ALLOWED_MIME_TYPES.has(file.type)) return json(415, { error: 'Use a PDF, JPG, PNG or WEBP document.' });
  if (scope === 'driver' && !DRIVER_DOC_TYPES.has(docType)) return json(400, { error: 'Unsupported Driver document type.' });
  if (scope === 'vehicle' && !VEHICLE_DOC_TYPES.has(docType)) return json(400, { error: 'Unsupported Vehicle document type.' });
  if (scope === 'vehicle' && !vehicleId) return json(400, { error: 'Choose the vehicle this document belongs to.' });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedMagicBytes(bytes, file.type)) {
    return json(415, { error: 'Document content does not match the selected file type.' });
  }

  let authorisedVehicle: VehicleRow | null = null;
  if (scope === 'vehicle') {
    const { data: vehicle, error: vehicleError } = await supabaseAdmin!
      .from('vehicles')
      .select('id,reg_plate,make,model,status,assigned_driver_id,company_id')
      .eq('id', vehicleId)
      .eq('company_id', context.companyId)
      .maybeSingle();
    if (vehicleError) return json(500, { error: 'The selected vehicle could not be verified.' });
    if (!vehicle) return json(404, { error: 'Vehicle not found in your company.' });
    if (!context.canManageCompanyVehicles && vehicle.assigned_driver_id !== context.driverId) {
      return json(403, { error: 'You can upload documents only for the vehicle assigned to you.' });
    }
    authorisedVehicle = vehicle as VehicleRow;
  }

  const fileName = sanitizeFilename(file.name || `${docType}.bin`);
  const category = scope === 'vehicle' ? `vehicle/${vehicleId}` : 'driver';
  const objectPath = `${context.companyId}/${context.driverId}/${category}/${crypto.randomUUID()}-${fileName}`;
  const fileSha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  const { error: storageError } = await supabaseAdmin!.storage.from('driver-docs').upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (storageError) return json(500, { error: `The file could not be stored: ${storageError.message}` });

  const cleanup = async () => {
    await supabaseAdmin!.storage.from('driver-docs').remove([objectPath]);
  };

  const insertResult = scope === 'vehicle'
    ? await supabaseAdmin!.from('vehicle_documents').insert({
        vehicle_id: authorisedVehicle!.id,
        document_name: docType,
        doc_type: docType,
        file_path: objectPath,
        issued_date: issuedDate,
        expiry_date: expiryDate,
        status: 'pending',
        uploaded_by: context.userId,
        file_sha256: fileSha256,
      }).select('id').single()
    : await supabaseAdmin!.from('driver_documents').insert({
        driver_id: context.driverId,
        doc_type: docType,
        file_path: objectPath,
        issued_date: issuedDate,
        expiry_date: expiryDate,
        status: 'pending',
        file_sha256: fileSha256,
      }).select('id').single();

  if (insertResult.error) {
    await cleanup();
    return json(500, { error: 'The document record could not be created. The uploaded file was removed safely.' });
  }

  return json(201, {
    ok: true,
    document_id: insertResult.data.id,
    scope,
    message: `${docType} submitted for review.`,
  });
}
