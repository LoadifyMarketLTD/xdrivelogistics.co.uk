import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function GET(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Server auth is not configured.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { id } = await params;
  if (!UUID_RE.test(id)) return json(400, { error: 'Invalid agreement ID.' });

  const { data: agreement, error } = await supabaseAdmin
    .from('registration_legal_acceptances')
    .select('id, user_id, signer_full_name, signed_pdf_bucket, signed_pdf_path, signed_pdf_hash, signed_pdf_created_at')
    .eq('id', id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (error) {
    if (['42P01', 'PGRST205', '42703'].includes(error.code ?? '')) {
      return json(503, { error: 'Signed agreement storage is not available in this environment.' });
    }
    return json(500, { error: error.message });
  }
  if (!agreement) return json(404, { error: 'Signed agreement not found.' });
  if (agreement.signed_pdf_bucket !== 'documents' || typeof agreement.signed_pdf_path !== 'string' || !agreement.signed_pdf_path) {
    return json(409, { error: 'This historical acceptance does not have a signed PDF package.' });
  }
  const requiredPrefix = `legal-agreements/${authData.user.id}/`;
  if (!agreement.signed_pdf_path.startsWith(requiredPrefix)) {
    return json(409, { error: 'Signed agreement storage reference failed integrity validation.' });
  }

  const filename = `XDrive-Signed-Agreement-${id.slice(0, 8).toUpperCase()}.pdf`;
  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(agreement.signed_pdf_path, 120, { download: filename });
  if (signedError || !signed?.signedUrl) return json(500, { error: signedError?.message ?? 'Signed agreement URL could not be created.' });

  return json(200, {
    url: signed.signedUrl,
    filename,
    signerFullName: agreement.signer_full_name,
    pdfHash: agreement.signed_pdf_hash,
    createdAt: agreement.signed_pdf_created_at,
    expiresInSeconds: 120,
  });
}
