import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../_lib/requireCompanyAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const text = (value: unknown, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const resolveStoragePath = (rawPath: string, expectedBucket: string) => {
  const value = rawPath.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');

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
    if (bucket !== expectedBucket) return null;
    const objectPath = parts.map((part) => decodeURIComponent(part)).join('/');
    return objectPath || null;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document service is temporarily unavailable.' });
  }

  const url = new URL(request.url);
  const companyId = text(url.searchParams.get('companyId'), 80);
  const kind = text(url.searchParams.get('kind'), 20);
  const documentId = text(url.searchParams.get('id'), 80);
  const download = url.searchParams.get('download') === '1';

  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;
  if (!documentId || !['driver', 'vehicle'].includes(kind)) {
    return json(400, { error: 'Document kind and id are required.' });
  }

  let bucket = '';
  let rawPath = '';

  if (kind === 'driver') {
    const { data: document, error: documentError } = await supabaseAdmin
      .from('driver_identity_documents')
      .select('id, onboarding_application_id, file_path')
      .eq('id', documentId)
      .maybeSingle();
    if (documentError) return json(500, { error: 'Unable to resolve Driver document.' });
    if (!document) return json(404, { error: 'Driver document not found.' });

    const { data: application, error: applicationError } = await supabaseAdmin
      .from('onboarding_applications')
      .select('id, company_id, user_id, account_type')
      .eq('id', document.onboarding_application_id)
      .eq('company_id', admin.companyId)
      .eq('account_type', 'individual_driver')
      .maybeSingle();
    if (applicationError) return json(500, { error: 'Unable to verify Driver document tenancy.' });
    if (!application) return json(403, { error: 'Document does not belong to this company.' });

    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', application.user_id)
      .eq('company_id', admin.companyId)
      .limit(1)
      .maybeSingle();
    if (driverError) return json(500, { error: 'Unable to verify Driver company record.' });
    if (!driver) return json(403, { error: 'Driver document is not linked to a company Driver.' });

    bucket = 'onboarding-documents';
    rawPath = text(document.file_path);
  } else {
    const { data: document, error: documentError } = await supabaseAdmin
      .from('vehicle_documents')
      .select('id, vehicle_id, file_path')
      .eq('id', documentId)
      .maybeSingle();
    if (documentError) return json(500, { error: 'Unable to resolve Vehicle document.' });
    if (!document) return json(404, { error: 'Vehicle document not found.' });

    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('vehicles')
      .select('id')
      .eq('id', document.vehicle_id)
      .eq('company_id', admin.companyId)
      .maybeSingle();
    if (vehicleError) return json(500, { error: 'Unable to verify Vehicle document tenancy.' });
    if (!vehicle) return json(403, { error: 'Document does not belong to this company.' });

    bucket = 'vehicle-docs';
    rawPath = text(document.file_path);
  }

  if (!rawPath) return json(409, { error: 'This document has no stored file.' });
  const objectPath = resolveStoragePath(rawPath, bucket);
  if (!objectPath) return json(409, { error: 'Stored document reference is invalid.' });

  const signedResult = download
    ? await supabaseAdmin.storage.from(bucket).createSignedUrl(objectPath, 300, { download: true })
    : await supabaseAdmin.storage.from(bucket).createSignedUrl(objectPath, 300);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    return json(500, { error: signedResult.error?.message ?? 'Secure document link could not be created.' });
  }

  const fileName = objectPath.split('/').pop() || `document-${documentId}`;
  return json(200, {
    url: signedResult.data.signedUrl,
    fileName,
    expiresInSeconds: 300,
  });
}
