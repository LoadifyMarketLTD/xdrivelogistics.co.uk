import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { isCanonicalPodPath, POD_BUCKET } from '@/lib/podStorage';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];

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
      'id, company_id, awarded_carrier_company_id, created_by, delivery_photos, pod_photos'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return json(500, { error: jobError.message });
  if (!job) return json(404, { error: 'Job not found.' });

  const permittedPaths = new Set([
    ...stringArray(job.delivery_photos),
    ...stringArray(job.pod_photos),
  ]);

  if (!permittedPaths.has(objectPath)) {
    return json(404, { error: 'POD file is not linked to this job.' });
  }
  if (!isCanonicalPodPath(objectPath, { companyId: job.company_id, jobId })) {
    return json(400, { error: 'POD path is invalid.' });
  }

  const companyIds = [job.company_id, job.awarded_carrier_company_id].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

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
    .from(POD_BUCKET)
    .createSignedUrl(objectPath, 120);

  if (signedUrlError || !signed?.signedUrl) {
    return json(500, {
      error: signedUrlError?.message ?? 'Unable to create a POD download link.',
    });
  }

  return json(200, {
    signedUrl: signed.signedUrl,
    expiresIn: 120,
  });
}
