import { NextRequest, NextResponse } from 'next/server';

import { POST as uploadOnboardingDocument } from '../../../onboarding/documents/route';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isComplianceDriverContext, resolveComplianceDriver } from '../_lib';

export const runtime = 'nodejs';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  const resolved = await resolveComplianceDriver(request);
  if (!isComplianceDriverContext(resolved)) return resolved;

  const { data: application, error: applicationError } = await supabaseAdmin!
    .from('onboarding_applications')
    .select('id,status,current_step,payload')
    .eq('user_id', resolved.userId)
    .maybeSingle();

  if (applicationError) {
    return json(500, { error: 'Canonical remediation application could not be loaded.' });
  }
  if (!application) {
    return json(409, { error: 'Canonical remediation application is missing.' });
  }

  const payload = application.payload && typeof application.payload === 'object'
    ? application.payload as Record<string, unknown>
    : {};
  const isLegacyRemediation = payload.legacy_driver_compliance_remediation === true;

  // Reuse the canonical onboarding uploader so MIME validation, secure storage,
  // fingerprinting and duplicate/fraud checks remain exactly the same.
  const response = await uploadOnboardingDocument(request);
  if (!response.ok || !isLegacyRemediation) return response;

  // The generic onboarding uploader moves normal onboarding back to in_progress.
  // Legacy compliance remediation is already submitted for Platform review, so
  // keep it reviewable instead of silently removing it from the review queue.
  const { error: restoreError } = await supabaseAdmin!
    .from('onboarding_applications')
    .update({
      status: 'under_review',
      current_step: 'compliance_remediation',
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', application.id);

  if (restoreError) {
    const uploaded = await response.clone().json().catch(() => ({})) as Record<string, unknown>;
    return json(503, {
      ...uploaded,
      error: 'Document was stored, but the remediation review state could not be restored. Do not upload the same file again; refresh and contact Platform support.',
      documentStored: true,
    });
  }

  return response;
}
