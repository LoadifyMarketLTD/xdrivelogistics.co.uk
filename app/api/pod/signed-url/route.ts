import { NextRequest, NextResponse } from 'next/server';
import { jobEvidenceReferences, isScopedPodObjectPath } from '../../../../lib/pod/jobEvidenceReferences';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'POD service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized - missing bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);

  if (authError || !user) {
    return json(401, { error: 'Unauthorized - invalid or expired token.' });
  }

  const jobId = request.nextUrl.searchParams.get('jobId')?.trim();
  const objectPath = request.nextUrl.searchParams.get('path')?.trim();

  if (!jobId || !objectPath) {
    return json(400, { error: 'jobId and path are required.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company_id, awarded_carrier_company_id, assigned_company_id, created_by, pickup_photos, collection_photo_url, delivery_photos, damage_photos, pod_photos, delivery_signature_data'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return json(500, { error: jobError.message });
  if (!job) return json(404, { error: 'Job not found.' });

  const companyIds = [
    job.company_id,
    job.awarded_carrier_company_id,
    job.assigned_company_id,
  ].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  const refs = jobEvidenceReferences(job);
  const signaturePath = job.delivery_signature_data && typeof job.delivery_signature_data === 'object' && !Array.isArray(job.delivery_signature_data)
    ? job.delivery_signature_data.evidence_path : null;
  const permittedPaths = new Set([...refs.pickupPhotos, ...refs.deliveryPhotos, ...refs.damagePhotos, ...refs.documents, refs.signature, signaturePath]);
  if (!permittedPaths.has(objectPath) || !isScopedPodObjectPath(objectPath, job.id, companyIds)) {
    return json(404, { error: 'POD file is not linked to this job.' });
  }

  let authorised = job.created_by === user.id;

  if (!authorised && companyIds.length > 0) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('company_id', companyIds)
      .limit(1)
      .maybeSingle();

    if (membershipError) return json(500, { error: membershipError.message });
    authorised = Boolean(membership?.id);
  }

  if (!authorised) {
    return json(403, { error: 'Forbidden - this POD is outside your company workspace.' });
  }

  const { data: signed, error: signedUrlError } = await supabaseAdmin.storage
    .from('pod-photos')
    .createSignedUrl(objectPath, 120);

  if (signedUrlError || !signed?.signedUrl) {
    const missing = signedUrlError && (/not found|does not exist/i.test(signedUrlError.message) || ('statusCode' in signedUrlError && String(signedUrlError.statusCode) === '404'));
    return json(missing ? 404 : 503, { error: 'POD evidence file is unavailable.' });
  }

  return json(200, {
    signedUrl: signed.signedUrl,
    expiresIn: 120,
  });
}
