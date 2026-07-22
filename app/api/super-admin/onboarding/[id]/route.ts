import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePlatformOwner } from '../../../_lib/platformAuth';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformOwner(request);
  if (!access.ok) return respond(access.failure.status, { error: access.failure.error });
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid review action.' });

  const { id } = await params;
  const { data: reviewResult, error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
    p_application_id: id,
    p_actor_user_id: access.user.id,
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
