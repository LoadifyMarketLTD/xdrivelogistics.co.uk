import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const reviewStatusByAccountType: Record<string, string> = {
  broker_shipper: 'under_review',
  fleet_courier: 'compliance_review',
  owner_driver: 'compliance_review',
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized: invalid token.' });
  }

  const userId = authData.user.id;

  const { data: application, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (appError) return json(500, { error: appError.message });
  if (!application) return json(404, { error: 'Onboarding application not found.' });

  const reviewStatus = reviewStatusByAccountType[application.account_type] ?? 'under_review';

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      status: reviewStatus,
      current_step: 'pending_review',
      completion_percentage: 100,
      submitted_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', application.id)
    .select('*')
    .single();

  if (updateError) return json(500, { error: updateError.message });

  await supabaseAdmin.from('notification_events').insert({
    event_type: 'onboarding_submitted',
    entity_type: 'onboarding_application',
    entity_id: application.id,
    recipient_user_id: userId,
    payload: {
      onboarding_application_id: application.id,
      account_type: application.account_type,
      status: reviewStatus,
    },
  });

  return json(200, {
    application: updated,
    status: reviewStatus,
  });
}
