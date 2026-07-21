import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';
import { getOnboardingComplianceReadiness } from '../../../../../../lib/server/onboardingCompliance';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'owner') return null;
  return authData.user;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { id: companyId } = await params;
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, company_number, vat_number, email, phone, address_line1, status, company_type, created_by, created_at')
    .eq('id', companyId)
    .maybeSingle();

  if (companyError) return respond(500, { error: companyError.message });
  if (!company) return respond(404, { error: 'Company not found.' });

  let { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, company_id, current_step, completion_percentage, submitted_at, reviewed_at, review_notes, payload, updated_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!application && !applicationError && company.created_by) {
    const fallback = await supabaseAdmin
      .from('onboarding_applications')
      .select('id, user_id, email, account_type, status, company_id, current_step, completion_percentage, submitted_at, reviewed_at, review_notes, payload, updated_at')
      .eq('user_id', company.created_by)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    application = fallback.data;
    applicationError = fallback.error;
  }

  if (applicationError) return respond(500, { error: applicationError.message });
  if (!application) {
    return respond(200, {
      company,
      application: null,
      readiness: null,
      legacyCompanyWithoutOnboarding: true,
    });
  }

  if (!application.company_id) {
    const { error: linkError } = await supabaseAdmin
      .from('onboarding_applications')
      .update({ company_id: companyId })
      .eq('id', application.id)
      .eq('user_id', application.user_id);
    if (linkError) return respond(500, { error: linkError.message });
    application = { ...application, company_id: companyId };
  }

  const { data: readiness, error: readinessError } = await getOnboardingComplianceReadiness(supabaseAdmin, {
    applicationId: application.id,
  });
  if (readinessError) return respond(500, { error: readinessError });

  return respond(200, {
    company,
    application,
    readiness,
    legacyCompanyWithoutOnboarding: false,
  });
}
