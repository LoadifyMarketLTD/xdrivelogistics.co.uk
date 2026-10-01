import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { getCommercialLegalReadiness } from '../../_lib/commercialLegalReadiness';
import { getStripeCommercialReadiness } from '../../_lib/stripeCommercialReadiness';
import { getTransportBuyerRiskSnapshot } from '../../_lib/transportBuyerRisk';
import { resolveDriverOperationalEligibility } from '../../driver/_lib/operationalEligibility';
import {
  companyRecoveryAction, documentRecoveryHref, driverReadinessBlocker,
  resolveReadinessContext, unavailableReadinessBlocker,
  type ReadinessOperation, type WorkspaceBlocker,
} from '../../../../lib/workspaceReadiness';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const normal = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const json = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, {
  status, headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reviewStatuses = new Set(['submitted', 'under_review', 'compliance_review', 'admin_approval']);
const editableStatuses = new Set(['invited', 'draft', 'in_progress', 'request_changes']);

/** Advisory only. Transaction endpoints remain authoritative and never consume ready as permission. */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin || !supabaseValidator) {
    return json(503, { ready: false, error: 'Readiness service is temporarily unavailable.' });
  }
  const token = getBearerToken(request);
  if (!token) return json(401, { ready: false, error: 'Your session has expired. Sign in again.' });
  try {
    const { data: authData, error: authError } = await supabaseValidator.auth.getUser(token);
    if (authError || !authData.user) return json(401, { ready: false, error: 'Your session has expired. Sign in again.' });
    const admin = supabaseAdmin;
    const userId = authData.user.id;
    const requestedCompanyId = new URL(request.url).searchParams.get('companyId')?.trim() || null;
    if (requestedCompanyId && !uuid.test(requestedCompanyId)) return json(400, { ready: false, error: 'Invalid company context.' });
    const [profileResult, membershipResult, driversResult] = await Promise.all([
      admin.from('profiles').select('user_id,company_id,role,status').eq('user_id', userId).maybeSingle(),
      admin.from('company_memberships').select('company_id,role_in_company,status').eq('user_id', userId).eq('status', 'active'),
      admin.from('drivers').select('id,company_id,driver_type').eq('user_id', userId),
    ]);
    if (profileResult.error || membershipResult.error) return json(503, { ready: false, error: 'Your account and company access could not be verified. Please retry.' });
    const memberships = membershipResult.data ?? [];
    // Never silently choose another company, even if the requested membership is inactive.
    const preferredId = requestedCompanyId || profileResult.data?.company_id;
    const membership = preferredId ? memberships.find((row) => row.company_id === preferredId)
      : memberships.length === 1 ? memberships[0] : null;
    if (requestedCompanyId && !membership) return json(403, { ready: false, error: 'This account has no active membership in the selected company. Contact your company administrator.' });
    if (!requestedCompanyId && !membership && memberships.length > 0) return json(409, {
      ready: false, error: 'Your active company context is missing or ambiguous. Select the intended company workspace before continuing.',
    });
    const companyId = typeof membership?.company_id === 'string' ? membership.company_id : null;
    const [companyResult, applicationsResult] = await Promise.all([
      companyId ? admin.from('companies').select('id,name,status,company_type').eq('id', companyId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      admin.from('onboarding_applications').select('id,user_id,company_id,status,account_type,current_step').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ]);
    if (companyResult.error) return json(503, { ready: false, error: 'Company status could not be verified. Please retry.' });
    const applications = (applicationsResult.data ?? []).filter((row) => companyId ? row.company_id === companyId : !row.company_id);
    const unbound = (applicationsResult.data ?? []).filter((row) => !row.company_id);
    const matchingApplications = applications.length ? applications : companyId ? unbound : applications;
    const application = matchingApplications.length === 1 ? matchingApplications[0] : null;
    const drivers = (driversResult.data ?? []).filter((row) => row.company_id === companyId);
    const driver = drivers.length === 1 ? drivers[0] : null;
    const context = resolveReadinessContext({
      profileRole: profileResult.data?.role, membershipRole: membership?.role_in_company,
      companyType: companyResult.data?.company_type, driverType: driver?.driver_type,
      accountType: application?.account_type, companyId,
    });
    const isDriver = context.role === 'driver' || context.role === 'owner_driver';
    const canPost = ['owner', 'admin', 'dispatcher'].includes(normal(membership?.role_in_company)) && context.role !== 'driver';
    const operation: ReadinessOperation = context.role === 'customer' || context.role === 'broker' ? 'post_load' : isDriver && !canPost ? 'quote' : 'commercial';
    const blockers: WorkspaceBlocker[] = [];
    const addUnavailable = (check: string) => blockers.push(unavailableReadinessBlocker(check, operation));
    const support = (code: string, title: string, message: string): WorkspaceBlocker => ({
      code, title, message, operation, actionType: 'link', actionLabel: 'Contact support', actionHref: context.root + '/support?reason=' + encodeURIComponent(code),
    });
    if (!profileResult.data || normal(profileResult.data.status) !== 'active') blockers.push(support(
      'ACCOUNT_STATUS_REQUIRED', 'Account access requires attention', 'Your account profile is missing or is not active. Support must review this; uploading a document does not automatically reactivate access.',
    ));
    if (applicationsResult.error) addUnavailable('Onboarding');
    else if (matchingApplications.length > 1) blockers.push(support('ONBOARDING_APPLICATION_CONFLICT', 'Onboarding records need reconciliation', 'Multiple onboarding applications match this account and company. Support must reconcile these records before a document can be uploaded safely.'));
    else if (!application && companyId && isDriver) blockers.push({
      code: 'ONBOARDING_APPLICATION_REQUIRED', title: 'Onboarding application is missing',
      message: 'Start or recover the driver onboarding application for this account. Company membership does not replace driver-specific onboarding evidence.',
      operation, actionType: 'link', actionLabel: 'Start / recover onboarding', actionHref: '/onboarding/resume',
    });
    if (!companyId) blockers.push({
      code: 'ONBOARDING_COMPANY_LINK_REQUIRED', title: 'Complete account onboarding',
      message: 'No active company membership is linked to this workspace. Continue onboarding or ask your company administrator to complete your membership.',
      operation, actionType: 'link', actionLabel: context.role === 'driver' ? 'Get company setup help' : 'Continue onboarding',
      actionHref: context.role === 'driver' ? context.root + '/support?reason=membership' : application ? context.onboardingHref : '/onboarding/resume',
    });
    if (application) {
      const status = normal(application.status);
      if (reviewStatuses.has(status)) blockers.push({
        code: 'ONBOARDING_REVIEW_PENDING', title: 'Onboarding is awaiting review',
        message: 'Your application has been submitted. Approval is still required; do not repeat onboarding or re-upload documents only because review is pending.',
        operation, actionType: 'link', actionLabel: 'View review status', actionHref: '/pending-approval',
      });
      else if (status === 'rejected') blockers.push(support('ONBOARDING_REJECTED', 'Onboarding requires support review', 'Your application was rejected. Contact support to review the decision and the required next steps.'));
      else if (editableStatuses.has(status)) blockers.push({
        code: 'ONBOARDING_INCOMPLETE', title: 'Complete onboarding', message: 'Finish the outstanding account details and submit your application for verification.',
        operation, actionType: 'link', actionLabel: 'Continue onboarding', actionHref: context.onboardingHref,
      });
      else if (status !== 'approved') blockers.push(support('ONBOARDING_STATUS_REVIEW', 'Onboarding status requires review', 'Support must review the current onboarding status before commercial activity can be confirmed.'));
      // The same canonical RPC is used by the driver transaction gate, including approved accounts.
      if (status === 'approved' || editableStatuses.has(status)) {
        const { data: missing, error } = await admin.rpc('get_missing_onboarding_documents', { p_application_id: application.id });
        if (error || !Array.isArray(missing)) addUnavailable('Documents');
        else for (const row of missing) {
          const docType = typeof row.doc_type === 'string' ? row.doc_type : '';
          if (!/^[a-z0-9_]+$/i.test(docType)) { addUnavailable('Documents'); continue; }
          const label = docType.replace(/_/g, ' ');
          const delegated = row.document_family === 'company' && !context.canManageCompany;
          blockers.push({
            code: 'DOCUMENT_REQUIRED_' + String(row.document_family) + '_' + docType,
            title: 'Document requires attention: ' + label,
            message: (typeof row.reason === 'string' ? row.reason : 'This document is missing, expired or not yet verified.') + ' Uploading evidence does not bypass verification.',
            operation, actionType: 'link', actionLabel: delegated ? 'Get company setup help' : 'Review / upload ' + label,
            actionHref: delegated ? context.root + '/support?reason=document-' + encodeURIComponent(docType) : documentRecoveryHref(context.onboardingHref, docType),
            missingDocuments: [docType], ...(companyId ? { companyId } : {}),
          });
        }
      }
    }
    if (companyId) {
      if (!['active', 'approved'].includes(normal(companyResult.data?.status))) blockers.push(support(
        'COMPANY_STATUS_REQUIRED', 'Company status requires attention', 'Your company is not active or approved. Review the document restrictions shown here, or ask support to review the account status.',
      ));
      await Promise.all([
        (async () => {
          try {
            const legal = await getCommercialLegalReadiness(admin, companyId);
            if (!legal.infrastructureAvailable) addUnavailable('Legal agreements');
            else if (!legal.ready) blockers.push({ code: 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED', title: 'Legal agreements must be accepted',
              message: context.canManageCompany ? 'Review and accept the current company commercial agreements.' : 'Your company owner or administrator must accept the company agreements. You cannot accept them on the company behalf from this role.',
              operation, ...companyRecoveryAction(context, 'legal') });
          } catch { addUnavailable('Legal agreements'); }
        })(),
        (async () => {
          try {
            const stripe = await getStripeCommercialReadiness(admin, companyId);
            if (!stripe.infrastructureAvailable) addUnavailable('Stripe');
            else if (!stripe.ready) blockers.push({ code: 'STRIPE_COMMERCIAL_READINESS_REQUIRED', title: 'Company Stripe setup is incomplete',
              message: context.canManageCompany ? 'Complete and activate the company Stripe account before posting or quoting.' : 'Your company owner or administrator must activate the company Stripe account. You do not need a personal Stripe account.',
              operation, ...companyRecoveryAction(context, 'stripe') });
          } catch { addUnavailable('Stripe'); }
        })(),
        (async () => {
          if (!canPost) return;
          try {
            const risk = await getTransportBuyerRiskSnapshot(admin, companyId, 0);
            if (!risk.infrastructureAvailable || !risk.snapshot) addUnavailable('Transport account');
            else if (!risk.snapshot.allowed) blockers.push({ code: 'TRANSPORT_BUYER_RISK_LIMIT', title: 'Transport account restriction',
              message: risk.snapshot.reason ?? 'Resolve the account restriction before posting more transport work.', operation: 'post_load', actionType: 'link',
              actionLabel: context.canManageCompany ? 'Review invoices & account' : 'Get company setup help',
              actionHref: !context.canManageCompany ? context.root + '/support?reason=transport-account'
                : context.root + (context.root === '/broker' || context.root === '/driver' ? '/finance' : '/invoices') });
          } catch { addUnavailable('Transport account'); }
        })(),
      ]);
      if (isDriver) {
        if (driversResult.error) addUnavailable('Driver readiness');
        else if (drivers.length > 1) blockers.push(support('DRIVER_PROFILE_CONFLICT', 'Driver records need reconciliation', 'Multiple driver profiles match this account and company. Support must resolve the assignment before driver readiness can be confirmed.'));
        else if (!driver) blockers.push(support('DRIVER_PROFILE_REQUIRED', 'Driver profile requires attention', 'A driver profile must be linked to this account and company before driver-originated quotes can be checked.'));
        else try {
          const eligibility = await resolveDriverOperationalEligibility(admin, String(driver.id));
          for (const reason of eligibility.blockers) blockers.push(driverReadinessBlocker(reason, context));
        } catch { addUnavailable('Driver readiness'); }
      }
    }
    const unique = [...new Map(blockers.map((blocker) => [blocker.code, blocker])).values()].sort((a, b) => a.code.localeCompare(b.code));
    return json(200, { ready: unique.length === 0, companyId, companyName: companyResult.data?.name ?? null,
      role: context.role, checkedAt: new Date().toISOString(), advisory: true, blockers: unique });
  } catch {
    return json(503, { ready: false, error: 'Your account requirements could not be verified. Please retry; existing restrictions remain in force.' });
  }
}
