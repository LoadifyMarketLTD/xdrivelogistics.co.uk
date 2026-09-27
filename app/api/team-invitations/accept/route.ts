import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

type TeamInvitationAcceptance = {
  membership_id: string;
  company_id: string;
  role_in_company: string;
  profile_role: string;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Team invitation service is not configured.' });
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

  const { data, error } = await supabaseAdmin
    .rpc('accept_company_team_invitation_atomic', {
      p_user_id: user.id,
    })
    .maybeSingle();

  if (error) {
    if (error.code === '23514') return json(409, { error: error.message });
    if (error.code === 'P0002') return json(404, { error: error.message });
    if (error.code === '40001') {
      return json(409, { error: 'Invitation changed while it was being accepted. Please retry.' });
    }
    return json(500, { error: 'Team invitation could not be accepted.' });
  }

  const accepted = (data ?? null) as TeamInvitationAcceptance | null;

  if (!accepted?.membership_id || !accepted?.company_id) {
    return json(500, { error: 'Team invitation activation did not return a membership.' });
  }

  return json(200, {
    accepted: true,
    membershipId: accepted.membership_id,
    companyId: accepted.company_id,
    role: accepted.role_in_company,
    profileRole: accepted.profile_role,
  });
}
