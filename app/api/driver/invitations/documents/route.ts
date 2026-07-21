import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import {
  FLEET_DRIVER_REQUIRED_DOCUMENTS,
  getFleetDriverInvitationReadiness,
  type FleetDriverRequiredDocument,
} from '../../../../../lib/server/fleetDriverInvitations';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const extensionFor = (file: File) => {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const bearer = getBearerToken(request);
  if (!bearer) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(bearer);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const form = await request.formData().catch(() => null);
  if (!form) return json(400, { error: 'Invalid multipart form.' });

  const invitationId = String(form.get('invitationId') ?? '').trim();
  const docType = String(form.get('docType') ?? '').trim() as FleetDriverRequiredDocument;
  const file = form.get('file');

  if (!invitationId || !FLEET_DRIVER_REQUIRED_DOCUMENTS.includes(docType)) {
    return json(400, { error: 'Invitation and a supported required document type are required.' });
  }
  if (!(file instanceof File) || file.size <= 0) return json(400, { error: 'A document file is required.' });
  if (file.size > MAX_FILE_SIZE) return json(413, { error: 'Document exceeds the 10 MB limit.' });
  if (!ALLOWED_TYPES.has(file.type)) return json(415, { error: 'Only PDF, JPG and PNG documents are accepted.' });

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from('fleet_driver_invitations')
    .select('id, driver_id, user_id, status')
    .eq('id', invitationId)
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (invitationError) return json(500, { error: invitationError.message });
  if (!invitation) return json(404, { error: 'Invitation not found.' });
  if (invitation.status !== 'accepted') {
    return json(409, { error: 'Documents may only be uploaded after accepting an invitation and before approval.' });
  }

  const path = `fleet-drivers/${invitation.id}/${docType}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: storageError } = await supabaseAdmin.storage
    .from('onboarding-documents')
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (storageError) return json(500, { error: storageError.message });

  const { data: existing } = await supabaseAdmin
    .from('driver_documents')
    .select('id, file_path')
    .eq('driver_id', invitation.driver_id)
    .eq('doc_type', docType)
    .maybeSingle();

  const { data: document, error: documentError } = await supabaseAdmin
    .from('driver_documents')
    .upsert(
      {
        driver_id: invitation.driver_id,
        doc_type: docType,
        file_path: path,
        status: 'pending',
        rejection_reason: null,
        verified_by: null,
        verified_at: null,
      },
      { onConflict: 'driver_id,doc_type' },
    )
    .select('id, driver_id, doc_type, file_path, status, expiry_date')
    .single();

  if (documentError || !document) {
    await supabaseAdmin.storage.from('onboarding-documents').remove([path]);
    return json(500, { error: documentError?.message ?? 'Failed to save document.' });
  }

  if (existing?.file_path && existing.file_path !== path) {
    await supabaseAdmin.storage.from('onboarding-documents').remove([existing.file_path]);
  }

  const { data: readiness, error: readinessError } = await getFleetDriverInvitationReadiness(
    supabaseAdmin,
    invitation.id,
  );
  if (readinessError) return json(500, { error: readinessError });

  return json(200, {
    document,
    replacedExistingDocument: Boolean(existing?.id),
    readiness,
  });
}
