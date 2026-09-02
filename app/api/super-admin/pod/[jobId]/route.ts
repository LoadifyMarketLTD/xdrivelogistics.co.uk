import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const SCHEMA_UNAVAILABLE_CODES = new Set(['42P01', 'PGRST202', 'PGRST205', '42883']);

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_missing']),
  reason: z.string().trim().min(5).max(2000),
});

const isSchemaUnavailable = (error: { code?: string; message?: string } | null | undefined) =>
  Boolean(
    error
    && ((error.code && SCHEMA_UNAVAILABLE_CODES.has(error.code))
      || error.message?.includes('platform_pod_reviews')
      || error.message?.includes('owner_review_job_pod')),
  );

const jsonArrayLength = (value: unknown) => Array.isArray(value) ? value.length : 0;
const signaturePresent = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(String(value).trim());
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { jobId } = await params;
  const jobResult = await supabaseAdmin
    .from('jobs')
    .select('id, load_ref, load_id, load_reference, booking_reference, status, company_id, pickup_location, delivery_location, delivery_signature_data, delivery_photos, pod_photos, hard_copy_pod, delivered_at, completed_at, broker_pod_review_status, broker_pod_review_note, broker_pod_reviewed_at')
    .eq('id', jobId)
    .maybeSingle();

  if (jobResult.error) return respond(500, { error: jobResult.error.message });
  if (!jobResult.data) return respond(404, { error: 'Job not found.' });

  const reviewResult = await supabaseAdmin
    .from('platform_pod_reviews')
    .select('status, note, reviewed_by, reviewed_at, evidence_snapshot, updated_at')
    .eq('job_id', jobId)
    .maybeSingle();

  if (reviewResult.error) {
    if (isSchemaUnavailable(reviewResult.error)) {
      return respond(503, {
        error: 'Platform POD review schema is not applied in this environment.',
        migrationRequired: '20260902080500_platform_pod_review.sql',
      });
    }
    return respond(500, { error: reviewResult.error.message });
  }

  const job = jobResult.data;
  const deliveryPhotoCount = jsonArrayLength(job.delivery_photos);
  const podPhotoCount = jsonArrayLength(job.pod_photos);
  const hasSignature = signaturePresent(job.delivery_signature_data);
  const hasHardCopy = typeof job.hard_copy_pod === 'string' && job.hard_copy_pod.trim().length > 0;
  const hasPhysicalEvidence = hasSignature || deliveryPhotoCount > 0 || podPhotoCount > 0 || hasHardCopy;

  return respond(200, {
    previewReadOnly: isSuperAdminDeployPreviewReadOnly(),
    job: {
      id: job.id,
      reference: job.load_ref ?? job.load_id ?? job.load_reference ?? job.booking_reference ?? job.id,
      status: job.status,
      companyId: job.company_id,
      pickup: job.pickup_location,
      delivery: job.delivery_location,
      deliveredAt: job.delivered_at,
      completedAt: job.completed_at,
    },
    evidence: {
      hasPhysicalEvidence,
      signaturePresent: hasSignature,
      deliveryPhotoCount,
      podPhotoCount,
      hardCopyPresent: hasHardCopy,
    },
    brokerReview: {
      status: job.broker_pod_review_status,
      note: job.broker_pod_review_note,
      reviewedAt: job.broker_pod_reviewed_at,
    },
    platformReview: reviewResult.data ? {
      status: reviewResult.data.status,
      note: reviewResult.data.note,
      reviewedBy: reviewResult.data.reviewed_by,
      reviewedAt: reviewResult.data.reviewed_at,
      evidenceSnapshot: reviewResult.data.evidence_snapshot,
      updatedAt: reviewResult.data.updated_at,
    } : null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    if (isSuperAdminDeployPreviewReadOnly()) {
      return respond(403, { error: 'Deploy Preview is read-only. Platform POD review was not changed.' });
    }
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: parsed.error.issues[0]?.message ?? 'Invalid Platform POD review payload.',
      details: parsed.error.flatten(),
    });
  }

  const { jobId } = await params;
  const { action, reason } = parsed.data;
  const { data, error } = await supabaseAdmin.rpc('owner_review_job_pod', {
    p_actor_user_id: owner.id,
    p_job_id: jobId,
    p_action: action,
    p_reason: reason,
  });

  if (error) {
    if (isSchemaUnavailable(error)) {
      return respond(503, {
        error: 'Platform POD review schema is not applied in this environment.',
        migrationRequired: '20260902080500_platform_pod_review.sql',
      });
    }
    if (error.code === 'P0002') return respond(404, { error: error.message });
    if (error.code === '23514' || error.code === '23502') return respond(409, { error: error.message });
    if (error.code === '42501') return respond(403, { error: error.message });
    return respond(500, { error: error.message });
  }

  return respond(200, {
    success: true,
    action,
    job: Array.isArray(data) ? data[0] ?? null : data,
  });
}
