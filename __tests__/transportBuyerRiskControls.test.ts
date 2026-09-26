import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(process.cwd(),'supabase/migrations/20260926181245_transport_buyer_exposure_controls.sql'),'utf8');
const helper = readFileSync(join(process.cwd(),'app/api/_lib/transportBuyerRisk.ts'),'utf8');
const createApi = readFileSync(join(process.cwd(),'app/api/jobs/create/route.ts'),'utf8');
const customerAward = readFileSync(join(process.cwd(),'app/api/customer/bids/[id]/award/route.ts'),'utf8');
const adminAward = readFileSync(join(process.cwd(),'app/api/admin/bids/[id]/accept/route.ts'),'utf8');
const ownerApi = readFileSync(join(process.cwd(),'app/api/super-admin/companies/[companyId]/buyer-risk/route.ts'),'utf8');
const ownerPage = readFileSync(join(process.cwd(),'app/super-admin/companies/buyer-risk/page.tsx'),'utf8');
const ownerNav = readFileSync(join(process.cwd(),'app/super-admin/_components/SuperAdminWorkspaceShell.tsx'),'utf8');

describe('transport buyer exposure controls', () => {
  it('uses a separate financial-risk control from fraud/onboarding risk', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.transport_buyer_risk_controls');
    expect(migration).toContain("risk_mode text NOT NULL DEFAULT 'restricted'");
    expect(migration).toContain("risk_mode IN ('restricted','cleared','blocked')");
    expect(migration).not.toContain('onboarding_applications_risk_status');
  });

  it('defaults new buyers to 3 active commitments and GBP 2500 exposure', () => {
    expect(migration).toContain('max_active_commitments integer NOT NULL DEFAULT 3');
    expect(migration).toContain('max_outstanding_exposure_gbp numeric(12,2) NOT NULL DEFAULT 2500');
    expect(migration).toContain('v_max_active integer := 3');
    expect(migration).toContain('v_max_exposure numeric(12,2) := 2500');
  });

  it('defines a new buyer from actual paid invoice history', () => {
    expect(migration).toContain("invoice.buyer_company_id = p_company_id");
    expect(migration).toContain("lower(COALESCE(invoice.payment_status::text,'')) = 'paid'");
    expect(migration).toContain('v_is_new_buyer := v_paid_invoice_count = 0');
  });

  it('calculates outstanding exposure from accepted commercial agreements minus recorded payments', () => {
    expect(migration).toContain('FROM public.job_commercial_agreements_effective agreement');
    expect(migration).toContain('JOIN public.invoice_payment_history history ON history.invoice_id = invoice.id');
    expect(migration).toContain('invoice.commercial_agreement_id = agreement.id');
    expect(migration).toContain('COALESCE(agreement.agreed_gross_amount, agreement.agreed_amount, 0)');
  });

  it('blocks posting at the database boundary once the current limit is reached', () => {
    expect(migration).toContain('CREATE TRIGGER trg_guard_transport_buyer_publish');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF status,current_status ON public.jobs');
    expect(migration).toContain("'publish_blocked'");
    expect(migration).toContain("HINT = 'TRANSPORT_BUYER_RISK_LIMIT'");
  });

  it('blocks an award if the quoted carrier amount would push exposure over the limit', () => {
    expect(migration).toContain('CREATE TRIGGER trg_guard_transport_buyer_booking_offer');
    expect(migration).toContain('BEFORE INSERT ON public.job_booking_offers');
    expect(migration).toContain('NEW.quoted_amount');
    expect(migration).toContain("'award_blocked'");
    expect(migration).toContain('v_outstanding + v_projected > v_max_exposure');
  });

  it('allows a Platform Owner to review mode and custom limits with an audited reason', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.fn_review_transport_buyer_risk');
    expect(migration).toContain("lower(COALESCE(profile.role::text,'')) = 'owner'");
    expect(migration).toContain("lower(COALESCE(profile.status::text,'')) = 'active'");
    expect(migration).toContain('Transport buyer risk review requires a reason of at least 5 characters.');
    expect(migration).toContain("'risk_reviewed'");
    expect(ownerApi).toContain('verifyPlatformOwner(request)');
    expect(ownerApi).toContain(".rpc('fn_review_transport_buyer_risk'");
  });

  it('prechecks publish and both award APIs while keeping DB enforcement authoritative', () => {
    expect(createApi).toContain('getTransportBuyerRiskSnapshot(supabaseAdmin, input.companyId, 0)');
    expect(createApi).toContain('transportBuyerRiskBlockedPayload');
    expect(customerAward).toContain('getTransportBuyerRiskSnapshot(supabaseAdmin, job.company_id as string, projectedAmount)');
    expect(adminAward).toContain('getTransportBuyerRiskSnapshot(supabaseAdmin, jobCompanyId, projectedAmount)');
    expect(customerAward).toContain("rpcError.hint ?? '') === 'TRANSPORT_BUYER_RISK_LIMIT'");
    expect(adminAward).toContain("rpcError.hint ?? '') === 'TRANSPORT_BUYER_RISK_LIMIT'");
  });

  it('returns a structured risk payload with current and projected exposure', () => {
    expect(helper).toContain("code: 'TRANSPORT_BUYER_RISK_LIMIT'");
    expect(helper).toContain('activeCommitments: snapshot.active_commitments');
    expect(helper).toContain('outstandingExposureGbp: snapshot.outstanding_exposure_gbp');
    expect(helper).toContain('projectedExposureGbp: snapshot.projected_exposure_gbp');
    expect(helper).toContain('maxOutstandingExposureGbp: snapshot.max_outstanding_exposure_gbp');
  });

  it('keeps drafts outside the automatic publish gate', () => {
    expect(createApi).toContain('if (input.publish)');
    expect(migration).toContain("IF v_new_status <> 'posted'");
  });

  it('makes buyer-risk controls visible in Super Admin navigation', () => {
    expect(ownerNav).toContain("{ id: 'buyer-risk', label: 'Buyer Risk & Exposure', href: '/super-admin/companies/buyer-risk' }");
    expect(ownerPage).toContain('Transport Buyer Exposure Controls');
    expect(ownerPage).toContain("<ProtectedRoute allowedRoles={['owner']}");
  });

  it('shows verified exposure metrics, thresholds and audited review controls', () => {
    expect(ownerPage).toContain('Outstanding exposure');
    expect(ownerPage).toContain('Active commitments');
    expect(ownerPage).toContain('Maximum outstanding exposure (GBP)');
    expect(ownerPage).toContain('Maximum active commitments');
    expect(ownerPage).toContain('Audit reason');
    expect(ownerPage).toContain("option value=\"cleared\"");
    expect(ownerPage).toContain("option value=\"blocked\"");
    expect(ownerPage).toContain('Risk audit history');
  });});
