import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { buildSignedPodPresentations } from '../../../../driver/mobile/podPresentation';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'POD service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company_id, awarded_carrier_company_id, assigned_company_id, created_by, pod_generated, pod_generated_at, updated_at, delivery_photos, damage_photos, pod_photos, delivery_signature_data, client_signature_name, driver_notes, status_history',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const allowedCompanyIds = [
    job.company_id,
    job.awarded_carrier_company_id,
    job.assigned_company_id,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  let authorised = job.created_by === authData.user.id;
  if (!authorised && allowedCompanyIds.length > 0) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .in('company_id', allowedCompanyIds)
      .limit(1)
      .maybeSingle();

    if (membershipError) return respond(500, { error: membershipError.message });
    authorised = Boolean(membership?.id);
  }

  if (!authorised) {
    return respond(403, { error: 'This POD is outside your authorised workspace.' });
  }

  const storageCompanyId =
    job.awarded_carrier_company_id ??
    job.assigned_company_id ??
    job.company_id ??
    null;

  try {
    const presentations = await buildSignedPodPresentations(
      [job],
      storageCompanyId,
    );
    return respond(200, {
      pod: presentations.get(jobId) ?? null,
      jobId,
    });
  } catch (reason) {
    return respond(500, {
      error:
        reason instanceof Error
          ? reason.message
          : 'POD presentation could not be created.',
    });
  }
}
