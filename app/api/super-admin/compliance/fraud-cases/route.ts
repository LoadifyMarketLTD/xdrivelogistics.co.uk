import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const reviewSchema = z.object({
  caseId: z.string().uuid(),
  action: z.enum(['investigate', 'clear', 'confirm', 'dismiss']),
  reason: z.string().trim().min(3).max(5000),
});

const verifyPlatformOwner = async (request: NextRequest) => {
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

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') ?? 'open').trim().toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 250) || 250, 500);

  let query = supabaseAdmin
    .from('fraud_review_cases')
    .select(
      'id, subject_user_id, subject_company_id, onboarding_application_id, matched_user_id, matched_company_id, case_type, severity, status, automatic_hold, evidence, decision_reason, assigned_to, decided_by, decided_at, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: cases, error: casesError } = await query;
  if (casesError) return respond(500, { error: casesError.message });

  const companyIds = Array.from(
    new Set(
      (cases ?? [])
        .flatMap((row) => [row.subject_company_id, row.matched_company_id])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const applicationIds = Array.from(
    new Set(
      (cases ?? [])
        .map((row) => row.onboarding_application_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [companiesResult, applicationsResult] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('companies').select('id, name, status').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length
      ? supabaseAdmin
          .from('onboarding_applications')
          .select('id, email, account_type, risk_status, risk_reason')
          .in('id', applicationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relatedError = [companiesResult.error, applicationsResult.error].find(Boolean);
  if (relatedError) return respond(500, { error: relatedError.message });

  const companyById = new Map(
    (companiesResult.data ?? []).map((row) => [
      row.id as string,
      { name: String(row.name ?? 'Unknown Company'), status: String(row.status ?? 'unknown') },
    ]),
  );
  const applicationById = new Map(
    (applicationsResult.data ?? []).map((row) => [
      row.id as string,
      {
        email: String(row.email ?? ''),
        accountType: String(row.account_type ?? ''),
        riskStatus: String(row.risk_status ?? 'clear'),
        riskReason: typeof row.risk_reason === 'string' ? row.risk_reason : null,
      },
    ]),
  );

  const rows = (cases ?? []).map((row) => {
    const application = row.onboarding_application_id
      ? applicationById.get(row.onboarding_application_id as string)
      : null;
    const subjectCompany = row.subject_company_id
      ? companyById.get(row.subject_company_id as string)
      : null;
    const matchedCompany = row.matched_company_id
      ? companyById.get(row.matched_company_id as string)
      : null;

    return {
      ...row,
      applicant_email: application?.email ?? '',
      account_type: application?.accountType ?? '',
      application_risk_status: application?.riskStatus ?? '',
      application_risk_reason: application?.riskReason ?? null,
      subject_company_name: subjectCompany?.name ?? null,
      subject_company_status: subjectCompany?.status ?? null,
      matched_company_name: matchedCompany?.name ?? null,
      matched_company_status: matchedCompany?.status ?? null,
    };
  });

  return respond(200, {
    rows,
    summary: {
      total: rows.length,
      critical: rows.filter((row) => row.severity === 'critical').length,
      high: rows.filter((row) => row.severity === 'high').length,
      automatic_holds: rows.filter((row) => row.automatic_hold === true).length,
      open: rows.filter((row) => row.status === 'open').length,
      investigating: rows.filter((row) => row.status === 'investigating').length,
    },
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'A valid case, action and written reason are required.' });
  }

  const { data: currentCase, error: caseError } = await supabaseAdmin
    .from('fraud_review_cases')
    .select('id, status, subject_user_id, subject_company_id, onboarding_application_id')
    .eq('id', parsed.data.caseId)
    .maybeSingle();

  if (caseError) return respond(500, { error: caseError.message });
  if (!currentCase) return respond(404, { error: 'Fraud review case not found.' });

  const nextStatus = {
    investigate: 'investigating',
    clear: 'cleared',
    confirm: 'confirmed',
    dismiss: 'dismissed',
  }[parsed.data.action];

  const decisionPayload: Record<string, unknown> = {
    status: nextStatus,
    decision_reason: parsed.data.reason,
    assigned_to: owner.id,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.action !== 'investigate') {
    decisionPayload.decided_by = owner.id;
    decisionPayload.decided_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from('fraud_review_cases')
    .update(decisionPayload)
    .eq('id', parsed.data.caseId);

  if (updateError) return respond(500, { error: updateError.message });

  if (currentCase.onboarding_application_id) {
    if (parsed.data.action === 'confirm') {
      const { error: applicationError } = await supabaseAdmin
        .from('onboarding_applications')
        .update({
          risk_status: 'confirmed_fraud',
          risk_reason: parsed.data.reason,
          risk_updated_at: new Date().toISOString(),
          risk_reviewed_by: owner.id,
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: owner.id,
          review_notes: parsed.data.reason,
        })
        .eq('id', currentCase.onboarding_application_id);

      if (applicationError) return respond(500, { error: applicationError.message });
    }

    if (parsed.data.action === 'clear' || parsed.data.action === 'dismiss') {
      const { count: unresolvedCount, error: unresolvedError } = await supabaseAdmin
        .from('fraud_review_cases')
        .select('id', { count: 'exact', head: true })
        .eq('onboarding_application_id', currentCase.onboarding_application_id)
        .in('status', ['open', 'investigating', 'confirmed'])
        .neq('id', currentCase.id);

      if (unresolvedError) return respond(500, { error: unresolvedError.message });

      if ((unresolvedCount ?? 0) === 0) {
        const { error: clearError } = await supabaseAdmin
          .from('onboarding_applications')
          .update({
            risk_status: 'clear',
            risk_reason: null,
            risk_updated_at: new Date().toISOString(),
            risk_reviewed_by: owner.id,
          })
          .eq('id', currentCase.onboarding_application_id);

        if (clearError) return respond(500, { error: clearError.message });
      }
    }
  }

  if (parsed.data.action === 'confirm' && currentCase.subject_user_id) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'blocked' })
      .eq('user_id', currentCase.subject_user_id);

    if (profileError) return respond(500, { error: profileError.message });
  }

  await supabaseAdmin.from('owner_audit_log').insert({
    actor_user_id: owner.id,
    target_company_id: currentCase.subject_company_id ?? null,
    action_type: `fraud_case_${parsed.data.action}`,
    old_status: currentCase.status,
    new_status: nextStatus,
    reason: parsed.data.reason,
    metadata: {
      fraud_case_id: currentCase.id,
      subject_user_id: currentCase.subject_user_id,
      onboarding_application_id: currentCase.onboarding_application_id,
    },
  });

  return respond(200, {
    success: true,
    caseId: currentCase.id,
    status: nextStatus,
  });
}
