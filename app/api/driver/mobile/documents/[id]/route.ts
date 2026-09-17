import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../../_lib';

type DocumentRecord = {
  id: string;
  doc_type: string | null;
  file_path: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string | null;
  rejection_reason: string | null;
  risk_status: string | null;
  verified_at: string | null;
};

function mimeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
async function signedPresentation(document: DocumentRecord, isVehicleDocument: boolean) {
  const storagePath = String(document.file_path ?? '').trim();
  if (!storagePath) return response({ error: 'The secure document file is not available.' }, 404);
  const { data, error } = await supabaseAdmin!.storage.from('driver-docs').createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) return response({ error: 'The secure document file could not be opened.' }, 503);
  return response({
    document: {
      id: document.id,
      type: document.doc_type ?? 'Document',
      issuedDate: document.issued_date,
      expiryDate: document.expiry_date,
      status: document.status ?? 'pending',
      rejectionReason: document.rejection_reason,
      riskStatus: document.risk_status,
      verifiedAt: document.verified_at,
      isVehicleDocument,
      fileName: storagePath.split('/').pop() ?? 'document',
      mimeType: mimeFromPath(storagePath),
    },
    signedUrl: data.signedUrl,
    expiresInSeconds: 300,
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;
  if (!id) return response({ error: 'Document id is required.' }, 400);
  const driverDocument = await supabaseAdmin!
    .from('driver_documents')
    .select('id,doc_type,file_path,issued_date,expiry_date,status,rejection_reason,risk_status,verified_at')
    .eq('id', id)
    .eq('driver_id', driver.driverId)
    .maybeSingle();
  if (driverDocument.error) return response({ error: 'Document ownership could not be verified.' }, 500);
  if (driverDocument.data) return signedPresentation(driverDocument.data as DocumentRecord, false);

  let vehiclesQuery = supabaseAdmin!.from('vehicles').select('id').eq('assigned_driver_id', driver.driverId);
  if (driver.companyId) vehiclesQuery = vehiclesQuery.eq('company_id', driver.companyId);
  const { data: vehicles, error: vehicleError } = await vehiclesQuery.limit(20);
  if (vehicleError) return response({ error: 'Vehicle document ownership could not be verified.' }, 500);
  const vehicleIds = (vehicles ?? []).map((vehicle) => String(vehicle.id ?? '')).filter(Boolean);
  if (!vehicleIds.length) return response({ error: 'Document not found.' }, 404);

  const vehicleDocument = await supabaseAdmin!
    .from('vehicle_documents')
    .select('id,doc_type,file_path,issued_date,expiry_date,status,rejection_reason,risk_status,verified_at')
    .eq('id', id)
    .in('vehicle_id', vehicleIds)
    .maybeSingle();
  if (vehicleDocument.error) return response({ error: 'Vehicle document could not be loaded.' }, 500);
  if (!vehicleDocument.data) return response({ error: 'Document not found.' }, 404);
  return signedPresentation(vehicleDocument.data as DocumentRecord, true);
}
