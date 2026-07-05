import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../_lib/supabaseAdmin';

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  category: z.enum(['bug', 'feature_request', 'general', 'compliment', 'other']).default('general'),
  message: z.string().trim().min(1).max(3000),
  page_url: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Feedback service is unavailable.' },
      { status: 503 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', details: parsed.error.flatten() }, { status: 400 });
  }

  const { rating, category, message, page_url } = parsed.data;

  // Resolve company_id from active membership (best-effort)
  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { error } = await supabaseAdmin.from('user_feedback').insert({
    user_id: authData.user.id,
    company_id: membership?.company_id ?? null,
    rating: rating ?? null,
    category,
    message,
    page_url: page_url ?? null,
  });

  if (error) {
    console.error('[feedback] insert failed', { code: error.code });
    return NextResponse.json({ error: 'Failed to submit feedback. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
