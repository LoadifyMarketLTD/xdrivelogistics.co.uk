import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
} from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import {
  isDriverContext,
  requireDriver,
  respond,
} from '../../../_lib';

export const runtime = 'nodejs';

const MAX_POD_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf']);

const safeFileName = (value: string) => {
  const cleaned = value
    .replace(/[\r\n]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  return cleaned || 'pod-file';
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  const podEnabled = await getFeatureFlag(supabaseAdmin, 'pod_capture');
  if (!podEnabled) return respond(503, { error: 'POD capture is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });

  const { id: jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const requestedKind = request.nextUrl.searchParams.get('kind')?.trim().toLowerCase();
  const kind = requestedKind === 'document' ? 'documents' : requestedKind === 'photo' ? 'photos' : null;
  if (!kind) return respond(400, { error: 'POD upload kind must be photo or document.' });

  if (kind === 'photos' && !ALLOWED_IMAGE_TYPES.has(contentType)) {
    return respond(415, { error: 'POD photos must be JPEG, PNG or WebP.' });
  }
  if (kind === 'documents' && !ALLOWED_DOCUMENT_TYPES.has(contentType)) {
    return respond(415, { error: 'POD documents must be PDF files.' });
  }

  const rawLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(rawLength) && rawLength > MAX_POD_FILE_BYTES) {
    return respond(413, { error: 'POD file exceeds the 10 MB limit.' });
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await request.arrayBuffer();
  } catch {
    return respond(400, { error: 'POD file could not be read.' });
  }
  if (bytes.byteLength === 0) return respond(400, { error: 'POD file is empty.' });
  if (bytes.byteLength > MAX_POD_FILE_BYTES) return respond(413, { error: 'POD file exceeds the 10 MB limit.' });

  const originalName = request.headers.get('x-file-name')?.trim() || (kind === 'photos' ? 'pod-photo.jpg' : 'pod-document.pdf');
  const fileName = safeFileName(originalName);
  const objectPath = `${jobId}/${kind}/${crypto.randomUUID()}-${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('pod-photos')
    .upload(objectPath, bytes, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });
  if (uploadError) return respond(500, { error: `POD upload failed: ${uploadError.message}` });

  return NextResponse.json({
    ok: true,
    objectPath,
    kind: kind === 'photos' ? 'photo' : 'document',
    sizeBytes: bytes.byteLength,
  });
}
