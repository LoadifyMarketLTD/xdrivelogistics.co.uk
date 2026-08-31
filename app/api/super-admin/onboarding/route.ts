import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

type ApplicationRow = {
  id: string;
  user_id: string;
  email: string | null;
  account_type: string | null;
  status: string | null;
  current_step: string | null;
  completion_percentage: number | null;
  risk_status: string | null;
  risk_reason: string | null;
  company_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  submitted_at: string | null;
  last_activity_at: string | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
  status: string | null;
};

type MissingDocumentRow = {
  doc_type?: string | null;
  required_doc_type?: string | null;
  document_type?: string | null;
};

const COMPANY_BOUND_ACCOUNT_TYPES = new Set([
  'broker_shipper',
  'fleet_courier',
  'owner_driver',
  'individual_driver',
  'company_driver',
]);

const APPROVABLE_COMPANY_STATUSES = new Set(['pending_approval', 'approved', 'active']);

const normalized = (value: string | null | undefined, fallback = '') => {
  const result = value?.trim() ?? '';
  return result || fallback;
};

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

  const admin = supabaseAdmin;
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: platform owner role required.' });

  const { data: rawApplications, error: applicationsError } = await admin
    .from('onboarding_applications')
    .select(
      'id, user_id, email, account_type, status, current_step, completion_percentage, risk_status, risk_reason, company_id, payload, created_at, submitted_at, last_activity_at',
    )
    .in('status', ['submitted', 'under_review', 'request_changes'])
    .order('last_activity_at', { ascending: false })
    .limit(250);

  if (applicationsError) return respond(500, { error: applicationsError.message });

  const applications = (rawApplications ?? []) as ApplicationRow[];
  const companyIds = Array.from(
    new Set(applications.map((application) => application.company_id).filter((value): value is string => Boolean(value))),
  );

  const companiesById = new Map<string, CompanyRow>();
  if (companyIds.length > 0) {
    const { data: rawCompanies, error: companiesError } = await admin
      .from('companies')
      .select('id, name, status')
      .in('id', companyIds);

    if (companiesError) return respond(500, { error: companiesError.message });

    ((rawCompanies ?? []) as CompanyRow[]).forEach((company) => {
      companiesById.set(company.id, company);
    });
  }

  const output = await Promise.all(
    applications.map(async (application) => {
      const applicationId = application.id;
      const companyId = application.company_id;
      const accountType = normalized(application.account_type).toLowerCase();
      const company = companyId ? companiesById.get(companyId) : undefined;
      const companyStatus = normalized(company?.status).toLowerCase();
      const companyRequired = COMPANY_BOUND_ACCOUNT_TYPES.has(accountType);
      const companyBindingReady = !companyRequired || Boolean(companyId && company);
      const companyGovernanceReady = !companyRequired || APPROVABLE_COMPANY_STATUSES.has(companyStatus);

      const { data: rawMissing, error: missingError } = await admin.rpc(
        'get_missing_onboarding_documents',
        { p_application_id: applicationId },
      );

      const missingRows = (rawMissing ?? []) as MissingDocumentRow[];
      const missingDocuments = missingError
        ? []
        : missingRows.map((row) =>
            normalized(row.doc_type) ||
            normalized(row.required_doc_type) ||
            normalized(row.document_type) ||
            'required_document',
          );

      const riskStatus = normalized(application.risk_status, 'unknown').toLowerCase();
      const complianceCheckAvailable = !missingError;
      const approvalBlockers: string[] = [];

      if (!companyBindingReady) approvalBlockers.push('Explicit canonical company binding is required.');
      if (companyBindingReady && !companyGovernanceReady) {
        approvalBlockers.push(`Company governance status ${companyStatus || 'unknown'} blocks approval.`);
      }
      if (!complianceCheckAvailable) approvalBlockers.push('Canonical compliance check is unavailable.');
      if (missingDocuments.length > 0) {
        approvalBlockers.push(`Missing or invalid documents: ${missingDocuments.join(', ')}.`);
      }
      if (riskStatus !== 'clear') approvalBlockers.push(`Risk status is ${riskStatus}.`);

      const payload = application.payload ?? {};
      const applicantName =
        normalized(typeof payload.full_name === 'string' ? payload.full_name : null) ||
        normalized(typeof payload.contact_person === 'string' ? payload.contact_person : null) ||
        normalized(application.email, 'Unknown applicant');

      return {
        id: applicationId,
        user_id: application.user_id,
        applicant_name: applicantName,
        email: normalized(application.email),
        account_type: accountType,
        status: normalized(application.status),
        current_step: normalized(application.current_step),
        completion_percentage: Number(application.completion_percentage ?? 0),
        risk_status: riskStatus,
        risk_reason: normalized(application.risk_reason) || null,
        company_id: companyId,
        company_name: normalized(company?.name, companyId ? 'Unknown Company' : 'Not linked'),
        company_status: companyStatus || null,
        company_required: companyRequired,
        company_binding_ready: companyBindingReady,
        company_governance_ready: companyGovernanceReady,
        submitted_at: application.submitted_at,
        last_activity_at: application.last_activity_at ?? application.created_at,
        missing_documents: missingDocuments,
        compliance_check_available: complianceCheckAvailable,
        ready_for_approval: approvalBlockers.length === 0,
        approval_blockers: approvalBlockers,
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
