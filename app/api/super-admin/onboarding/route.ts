import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

type DbRow = Record<string, unknown>;

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const rows = (value: unknown): DbRow[] =>
  Array.isArray(value) ? (value as DbRow[]) : [];

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

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .from('onboarding_applications')
    .select(
      'id, user_id, email, account_type, status, current_step, completion_percentage, risk_status, risk_reason, company_id, payload, created_at, submitted_at, last_activity_at',
    )
    .in('status', ['submitted', 'under_review', 'request_changes'])
    .order('last_activity_at', { ascending: false })
    .limit(250);

  if (applicationsError) return respond(500, { error: applicationsError.message });

  const applications = rows(applicationsData);
  const companyIds = Array.from(
    new Set(applications.map((row) => text(row.company_id)).filter(Boolean)),
  );

  const companiesResult = companyIds.length
    ? await supabaseAdmin.from('companies').select('id, name, status').in('id', companyIds)
    : { data: [], error: null };

  if (companiesResult.error) return respond(500, { error: companiesResult.error.message });

  const companyById = new Map(
    rows(companiesResult.data).map((row) => [text(row.id), row]),
  );

  const output = await Promise.all(
    applications.map(async (application) => {
      const applicationId = text(application.id);
      const companyId = text(application.company_id);
      const payload =
        application.payload && typeof application.payload === 'object' && !Array.isArray(application.payload)
          ? (application.payload as DbRow)
          : {};
      const company = companyById.get(companyId);
      const companyStatus = text(company?.status);
      const companyGovernanceBlocked = ['rejected', 'suspended'].includes(companyStatus);

      const { data: missingData, error: missingError } = await supabaseAdmin.rpc(
        'get_missing_onboarding_documents',
        { p_application_id: applicationId },
      );

      const missingRows = missingError ? [] : rows(missingData);
      const missingDocuments = missingRows.map((row) =>
        text(row.doc_type) || text(row.required_doc_type) || text(row.document_type) || 'required_document',
      );
      const riskStatus = text(application.risk_status, 'clear');
      const complianceCheckAvailable = !missingError;
      const readyForApproval =
        complianceCheckAvailable &&
        riskStatus === 'clear' &&
        missingDocuments.length === 0 &&
        !companyGovernanceBlocked;

      return {
        id: applicationId,
        user_id: text(application.user_id),
        applicant_name:
          text(payload.full_name) ||
          text(payload.contact_person) ||
          text(application.email, 'Unknown applicant'),
        email: text(application.email),
        account_type: text(application.account_type),
        status: text(application.status),
        current_step: text(application.current_step),
        completion_percentage:
          typeof application.completion_percentage === 'number'
            ? application.completion_percentage
            : Number(application.completion_percentage ?? 0),
        risk_status: riskStatus,
        risk_reason: text(application.risk_reason) || null,
        company_id: companyId || null,
        company_name: text(company?.name, companyId ? 'Unknown Company' : 'Not linked'),
        company_status: companyStatus || null,
        company_governance_blocked: companyGovernanceBlocked,
        submitted_at: text(application.submitted_at) || null,
        last_activity_at: text(application.last_activity_at) || text(application.created_at),
        missing_documents: missingDocuments,
        compliance_check_available: complianceCheckAvailable,
        ready_for_approval: readyForApproval,
        compliance_error: missingError?.message ?? null,
      };
    }),
  );

  return respond(200, {
    rows: output,
    summary: {
      total: output.length,
      ready: output.filter((row) => row.ready_for_approval).length,
      blocked: output.filter((row) => !row.ready_for_approval).length,
      under_review: output.filter((row) => row.status === 'under_review').length,
      request_changes: output.filter((row) => row.status === 'request_changes').length,
    },
  });
}
