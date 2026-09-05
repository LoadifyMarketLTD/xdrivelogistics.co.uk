import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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

type CompanyRow = { id: string; name: string | null; status: string | null };
type MissingDocumentRow = { doc_type?: string | null; required_doc_type?: string | null; document_type?: string | null };

const COMPANY_BOUND_ACCOUNT_TYPES = new Set(['broker_shipper', 'fleet_courier', 'owner_driver', 'individual_driver', 'company_driver']);
const APPROVABLE_COMPANY_STATUSES = new Set(['pending_approval', 'approved', 'active']);
const ACTIVE_APPLICATION_STATUSES = ['submitted', 'under_review', 'request_changes'];

const normalized = (value: string | null | undefined, fallback = '') => {
  const result = value?.trim() ?? '';
  return result || fallback;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const admin = supabaseAdmin;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const offset = (page - 1) * limit;

  const { data: rawApplications, error: applicationsError, count } = await admin
    .from('onboarding_applications')
    .select('id, user_id, email, account_type, status, current_step, completion_percentage, risk_status, risk_reason, company_id, payload, created_at, submitted_at, last_activity_at', { count: 'exact' })
    .in('status', ACTIVE_APPLICATION_STATUSES)
    .order('last_activity_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (applicationsError) return respond(500, { error: applicationsError.message });
  if (typeof count !== 'number') return respond(500, { error: 'Onboarding governance returned an incomplete exact-count snapshot.' });

  const applications = (rawApplications ?? []) as ApplicationRow[];
  const companyIds = Array.from(new Set(applications.map((application) => application.company_id).filter((value): value is string => Boolean(value))));
  const companiesById = new Map<string, CompanyRow>();
  if (companyIds.length > 0) {
    const { data: rawCompanies, error: companiesError } = await admin.from('companies').select('id, name, status').in('id', companyIds);
    if (companiesError) return respond(500, { error: companiesError.message });
    for (const company of (rawCompanies ?? []) as CompanyRow[]) companiesById.set(company.id, company);
  }

  const output = await Promise.all(applications.map(async (application) => {
    const applicationId = application.id;
    const companyId = application.company_id;
    const accountType = normalized(application.account_type).toLowerCase();
    const company = companyId ? companiesById.get(companyId) : undefined;
    const companyStatus = normalized(company?.status).toLowerCase();
    const companyRequired = COMPANY_BOUND_ACCOUNT_TYPES.has(accountType);
    const companyBindingReady = !companyRequired || Boolean(companyId && company);
    const companyGovernanceReady = !companyRequired || APPROVABLE_COMPANY_STATUSES.has(companyStatus);

    const { data: rawMissing, error: missingError } = await admin.rpc('get_missing_onboarding_documents', { p_application_id: applicationId });
    const missingRows = (rawMissing ?? []) as MissingDocumentRow[];
    const missingDocuments = missingError ? [] : missingRows.map((row) =>
      normalized(row.doc_type) || normalized(row.required_doc_type) || normalized(row.document_type) || 'required_document');

    const riskStatus = normalized(application.risk_status, 'unknown').toLowerCase();
    const complianceCheckAvailable = !missingError;
    const approvalBlockers: string[] = [];
    if (!companyBindingReady) approvalBlockers.push('Explicit canonical company binding is required.');
    if (companyBindingReady && !companyGovernanceReady) approvalBlockers.push(`Company governance status ${companyStatus || 'unknown'} blocks approval.`);
    if (!complianceCheckAvailable) approvalBlockers.push('Canonical compliance check is unavailable.');
    if (missingDocuments.length > 0) approvalBlockers.push(`Missing or invalid documents: ${missingDocuments.join(', ')}.`);
    if (riskStatus !== 'clear') approvalBlockers.push(`Risk status is ${riskStatus}.`);

    const payload = application.payload ?? {};
    const applicantName = normalized(typeof payload.full_name === 'string' ? payload.full_name : null)
      || normalized(typeof payload.contact_person === 'string' ? payload.contact_person : null)
      || normalized(application.email, 'Unknown applicant');

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
  }));

  const summaryCounts = await Promise.all([
    admin.from('onboarding_applications').select('id', { count: 'exact', head: true }).in('status', ACTIVE_APPLICATION_STATUSES),
    admin.from('onboarding_applications').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    admin.from('onboarding_applications').select('id', { count: 'exact', head: true }).eq('status', 'request_changes'),
  ]);
  const summaryFailure = summaryCounts.find((result) => result.error || typeof result.count !== 'number');
  if (summaryFailure) return respond(500, { error: summaryFailure.error?.message ?? 'Onboarding summary exact count unavailable.' });

  return respond(200, {
    rows: output,
    summary: {
      total_active_applications: summaryCounts[0].count,
      under_review: summaryCounts[1].count,
      request_changes: summaryCounts[2].count,
      ready_on_page: output.filter((row) => row.ready_for_approval).length,
      blocked_on_page: output.filter((row) => !row.ready_for_approval).length,
    },
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      hasNextPage: page * limit < count,
      hasPrevPage: page > 1,
    },
  });
}
