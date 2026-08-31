import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid review action.' });
  }

  const { id } = await params;

  const { data: reviewResult, error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
    p_application_id: id,
    p_actor_user_id: owner.id,
    p_action: parsed.data.action,
    p_notes: parsed.data.notes ?? null,
  });

  if (reviewError) {
    const statusCode = reviewError.code === 'P0002' ? 404 : reviewError.code === '23514' ? 409 : 500;
    return respond(statusCode, { error: reviewError.message });
  }

  const reviewed = Array.isArray(reviewResult) ? reviewResult[0] : reviewResult;
  return respond(200, {
    success: true,
    onboardingApplicationId: reviewed?.onboarding_application_id ?? id,
    status: reviewed?.status ?? null,
  });
}
