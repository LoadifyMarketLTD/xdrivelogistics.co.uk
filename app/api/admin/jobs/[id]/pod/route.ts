import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';
import { isCanonicalPodPath, saveCanonicalPod } from '../../../../_lib/pod';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { id: jobId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return respond(400, { error: 'Invalid POD request.' });

  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const signatureData = typeof body.signatureData === 'string' ? body.signatureData.trim() : '';
  const photoPaths = stringArray(body.photoUris);
  const documentPaths = stringArray(body.documentUris);
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

  if (!recipientName) return respond(400, { error: 'Recipient name is required for POD.' });
  if (photoPaths.length > 10 || documentPaths.length > 10) {
    return respond(400, { error: 'A maximum of 10 POD photos and 10 documents is allowed.' });
  }
  if (photoPaths.some((path) => !isCanonicalPodPath(jobId, 'photos', path))) {
    return respond(400, { error: 'POD photos must be uploaded to the canonical XDrive job path.' });
  }
  if (documentPaths.some((path) => !isCanonicalPodPath(jobId, 'documents', path))) {
    return respond(400, { error: 'POD documents must be uploaded to the canonical XDrive job path.' });
  }
  if (signatureData && !/^data:image\/(png|jpeg);base64,/i.test(signatureData)) {
    return respond(400, { error: 'Recipient signature format is invalid.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, assigned_company_id, awarded_carrier_company_id, assigned_driver_id, vehicle_ref')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const executingCompanyId = job.awarded_carrier_company_id ?? job.assigned_company_id ?? job.company_id;
  if (!executingCompanyId) {
    return respond(409, { error: 'Executing company could not be resolved for this job.' });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', executingCompanyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'finance'])
    .maybeSingle();

  if (membershipError) return respond(500, { error: membershipError.message });
  if (!membership) {
    return respond(403, { error: 'Only Fleet Owner/Admin/Finance of the executing company may complete POD here.' });
  }

  let actorIsAssignedDriver = false;
  if (job.assigned_driver_id) {
    const { data: assignedDriver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('id, user_id')
      .eq('id', job.assigned_driver_id)
      .maybeSingle();
    if (driverError) return respond(500, { error: driverError.message });
    actorIsAssignedDriver = assignedDriver?.user_id === authData.user.id;
  }

  if (job.assigned_driver_id && !actorIsAssignedDriver && !reason) {
    return respond(400, {
      error: 'Please record why Fleet management is completing POD on behalf of the assigned driver.',
    });
  }

  try {
    const result = await saveCanonicalPod({
      supabase: supabaseAdmin,
      jobId,
      companyId: executingCompanyId,
      assignedDriverId: job.assigned_driver_id,
      vehicleRef: job.vehicle_ref,
      actorUserId: authData.user.id,
      actorRole: String(membership.role_in_company),
      source: actorIsAssignedDriver ? 'owner_driver' : 'fleet_dashboard',
      onBehalfOfDriverId: actorIsAssignedDriver ? null : job.assigned_driver_id,
      reason: actorIsAssignedDriver ? null : reason,
      recipientName,
      signatureData: signatureData || null,
      photoPaths,
      documentPaths,
      notes,
    });

    const { error: trackingError } = await supabaseAdmin
      .from('job_tracking_events')
      .insert({
        job_id: jobId,
        event_type: 'pod_uploaded',
        created_by: authData.user.id,
        user_id: authData.user.id,
        message: actorIsAssignedDriver
          ? 'Owner Driver completed POD.'
          : `Fleet ${membership.role_in_company} completed POD on behalf of the assigned driver.`,
        meta: {
          source: actorIsAssignedDriver ? 'owner_driver' : 'fleet_dashboard',
          on_behalf_of_driver_id: actorIsAssignedDriver ? null : job.assigned_driver_id,
          reason: actorIsAssignedDriver ? null : reason,
          pod_id: result.podId,
        },
      });

    if (trackingError) {
      console.error('POD saved but tracking event insert failed:', trackingError.message);
    }

    return respond(200, { ok: true, pod: result });
  } catch (reasonValue) {
    const message = reasonValue instanceof Error ? reasonValue.message : 'POD could not be saved.';
    const status = /too large/i.test(message) ? 413 : /storage|upload/i.test(message) ? 503 : 400;
    return respond(status, { error: message });
  }
}
