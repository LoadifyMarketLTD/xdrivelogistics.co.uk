import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { companyRecoveryAction, documentRecoveryHref, isSafeRecoveryHref, resolveReadinessContext } from '../lib/workspaceReadiness';

const state = vi.hoisted(() => ({
  token: 'test-token' as string | null,
  tables: {} as Record<string, { data: unknown; error: unknown }>,
  selects: [] as Array<[string, string]>, filters: [] as Array<[string, string, unknown]>,
  auth: vi.fn(), legal: vi.fn(), stripe: vi.fn(), risk: vi.fn(), operational: vi.fn(), rpc: vi.fn(),
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true, getBearerToken: () => state.token,
  supabaseValidator: { auth: { getUser: (...args: unknown[]) => state.auth(...args) } },
  supabaseAdmin: {
    rpc: (...args: unknown[]) => state.rpc(...args),
    from: (table: string) => {
      const result = () => state.tables[table] ?? { data: null, error: null };
      const chain = {
        select: (columns: string) => { state.selects.push([table, columns]); return chain; },
        eq: (column: string, value: unknown) => { state.filters.push([table, column, value]); return chain; },
        order: () => chain, limit: () => chain, maybeSingle: () => Promise.resolve(result()),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  },
}));
vi.mock('../app/api/_lib/commercialLegalReadiness', () => ({ getCommercialLegalReadiness: (...args: unknown[]) => state.legal(...args) }));
vi.mock('../app/api/_lib/stripeCommercialReadiness', () => ({ getStripeCommercialReadiness: (...args: unknown[]) => state.stripe(...args) }));
vi.mock('../app/api/_lib/transportBuyerRisk', () => ({ getTransportBuyerRiskSnapshot: (...args: unknown[]) => state.risk(...args) }));
vi.mock('../app/api/driver/_lib/operationalEligibility', () => ({ resolveDriverOperationalEligibility: (...args: unknown[]) => state.operational(...args) }));
import { GET } from '../app/api/workspace/readiness/route';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';
const USER = '22222222-2222-4222-8222-222222222222';
const application = { id: 'application-test', user_id: USER, company_id: COMPANY, status: 'approved', account_type: 'fleet_courier', current_step: 'complete' };
const table = (data: unknown) => ({ data, error: null });
async function request(query = '?companyId=' + COMPANY) {
  const response = await GET(new NextRequest('http://localhost/api/workspace/readiness' + query));
  return { status: response.status, payload: await response.json(), headers: response.headers };
}
beforeEach(() => {
  vi.resetAllMocks(); state.token = 'test-token'; state.selects = []; state.filters = [];
  state.tables = {
    profiles: table({ user_id: USER, company_id: COMPANY, role: 'company_admin', status: 'active' }),
    company_memberships: table([{ company_id: COMPANY, role_in_company: 'owner', status: 'active' }]),
    companies: table({ id: COMPANY, name: 'Test Carrier', status: 'active', company_type: 'carrier' }),
    onboarding_applications: table([application]), drivers: table([]),
  };
  state.auth.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  state.legal.mockResolvedValue({ ready: true, infrastructureAvailable: true });
  state.stripe.mockResolvedValue({ ready: true, infrastructureAvailable: true });
  state.risk.mockResolvedValue({ infrastructureAvailable: true, snapshot: { allowed: true } });
  state.operational.mockResolvedValue({ eligible: true, blockers: [] });
  state.rpc.mockResolvedValue({ data: [], error: null });
});

describe('workspace readiness uses real authorization boundaries', () => {
  it('requires a bearer session before reading any private data', async () => {
    state.token = null; expect((await request()).status).toBe(401); expect(state.selects).toEqual([]);
  });
  it('validates the token with getUser rather than trusting client role claims', async () => {
    await request('?companyId=' + COMPANY + '&role=platform_owner');
    expect(state.auth).toHaveBeenCalledWith('test-token');
    expect((await request()).payload.role).toBe('company_owner');
  });
  it('uses role_in_company and binds membership/profile/driver reads to the authenticated user', async () => {
    await request(); expect(state.selects).toContainEqual(['company_memberships', 'company_id,role_in_company,status']);
    for (const name of ['profiles', 'company_memberships', 'drivers', 'onboarding_applications']) expect(state.filters).toContainEqual([name, 'user_id', USER]);
  });
  it('does not fall back to another company when the selected membership is absent', async () => {
    expect((await request('?companyId=' + OTHER)).status).toBe(403); expect(state.legal).not.toHaveBeenCalled();
  });
  it('rejects malformed tenant identifiers', async () => { expect((await request('?companyId=bad-id')).status).toBe(400); });
  it('does not arbitrarily select the first of multiple memberships', async () => {
    state.tables.profiles = table({ user_id: USER, company_id: null, role: 'company_admin', status: 'active' });
    state.tables.company_memberships = table([{ company_id: COMPANY, role_in_company: 'owner' }, { company_id: OTHER, role_in_company: 'owner' }]);
    expect((await request('')).status).toBe(409);
  });
  it('does not disclose database error details or report a failed membership read as ready', async () => {
    state.tables.company_memberships.error = { message: 'private table internals' };
    const { status, payload } = await request(); expect(status).toBe(503); expect(payload.ready).toBe(false); expect(JSON.stringify(payload)).not.toContain('private table');
  });
  it('keeps all results uncached and marks them advisory', async () => {
    const { payload, headers } = await request(); expect(payload.ready).toBe(true); expect(payload.advisory).toBe(true); expect(headers.get('Cache-Control')).toContain('no-store');
  });
});

describe('individual restrictions always have a truthful recovery action', () => {
  it.each([
    ['carrier', 'fleet_courier', '/admin/settings/legal-agreements'],
    ['customer', 'customer_shipper', '/customer/account/legal-agreements'],
    ['broker', 'broker_shipper', '/broker/account/legal-agreements'],
    ['carrier', 'owner_driver', '/driver/account/legal-agreements'],
  ])('keeps %s / %s recovery in its proper workspace', async (companyType, accountType, href) => {
    state.tables.companies = table({ id: COMPANY, name: 'Test', status: 'active', company_type: companyType });
    state.tables.onboarding_applications = table([{ ...application, account_type: accountType }]);
    if (accountType === 'owner_driver') state.tables.drivers = table([{ id: 'driver-test', company_id: COMPANY, driver_type: 'owner_driver' }]);
    state.legal.mockResolvedValue({ ready: false, infrastructureAvailable: true });
    state.stripe.mockResolvedValue({ ready: false, infrastructureAvailable: true });
    const { payload } = await request();
    expect(payload.ready).toBe(false);
    expect(payload.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED', actionHref: href }),
      expect.objectContaining({ code: 'STRIPE_COMMERCIAL_READINESS_REQUIRED', actionType: 'stripe_setup', companyId: COMPANY }),
    ]));
  });
  it('never offers a company driver personal Stripe setup even with a forged owner role', async () => {
    state.tables.company_memberships = table([{ company_id: COMPANY, role_in_company: 'driver', status: 'active' }]);
    state.tables.drivers = table([{ id: 'driver-test', company_id: COMPANY, driver_type: 'company_driver' }]);
    state.tables.onboarding_applications = table([{ ...application, account_type: 'individual_driver' }]);
    state.legal.mockResolvedValue({ ready: false, infrastructureAvailable: true });
    state.stripe.mockResolvedValue({ ready: false, infrastructureAvailable: true });
    const { payload } = await request('?companyId=' + COMPANY + '&role=company_owner');
    expect(payload.role).toBe('driver'); expect(state.risk).not.toHaveBeenCalled();
    expect(payload.blockers.every((b: { actionType: string }) => b.actionType !== 'stripe_setup')).toBe(true);
    expect(payload.blockers).toContainEqual(expect.objectContaining({ code: 'STRIPE_COMMERCIAL_READINESS_REQUIRED', actionHref: '/driver/support?reason=stripe-company-setup' }));
  });
  it('reports each invalid required document even when onboarding was approved', async () => {
    state.rpc.mockResolvedValue({ data: [
      { document_family: 'company', doc_type: 'goods_in_transit', reason: 'Missing, unapproved or expired company document.' },
      { document_family: 'company', doc_type: 'public_liability', reason: 'Missing, unapproved or expired company document.' },
    ], error: null });
    const { payload } = await request(); expect(payload.ready).toBe(false);
    expect(state.rpc).toHaveBeenCalledWith('get_missing_onboarding_documents', { p_application_id: application.id });
    expect(payload.blockers).toHaveLength(2);
    expect(payload.blockers[0].actionHref).toBe('/onboarding/fleet/resume?document=goods_in_transit#onboarding-document-goods_in_transit');
    expect(payload.blockers[0].message).toContain('does not bypass verification');
  });
  it('does not call pending review an upload failure', async () => {
    state.tables.onboarding_applications = table([{ ...application, status: 'under_review' }]);
    const { payload } = await request(); expect(state.rpc).not.toHaveBeenCalled();
    expect(payload.blockers).toEqual([expect.objectContaining({ code: 'ONBOARDING_REVIEW_PENDING', actionHref: '/pending-approval' })]);
  });
  it('does not invent self-approval for a rejected application', async () => {
    state.tables.onboarding_applications = table([{ ...application, status: 'rejected' }]);
    expect((await request()).payload.blockers).toContainEqual(expect.objectContaining({ code: 'ONBOARDING_REJECTED', actionLabel: 'Contact support' }));
  });
  it('retains detected blockers when an independent verification service fails', async () => {
    state.legal.mockRejectedValue(new Error('network failure')); state.stripe.mockResolvedValue({ ready: false, infrastructureAvailable: true });
    const { payload } = await request(); expect(payload.ready).toBe(false);
    expect(payload.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ actionType: 'retry' }), expect.objectContaining({ actionType: 'stripe_setup' })]));
  });
  it.each(['legal', 'stripe'])('does not silently pass missing %s infrastructure', async (key) => {
    state[key as 'legal' | 'stripe'].mockResolvedValue({ ready: false, infrastructureAvailable: false });
    const { payload } = await request(); expect(payload.ready).toBe(false); expect(payload.blockers[0].actionType).toBe('retry');
  });
  it('does not use an onboarding application bound to another tenant', async () => {
    state.tables.onboarding_applications = table([{ ...application, company_id: OTHER, status: 'rejected' }]);
    await request(); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('refuses ambiguous application evidence instead of selecting the first approved row', async () => {
    state.tables.onboarding_applications = table([application, { ...application, id: 'another-application' }]);
    const { payload } = await request(); expect(payload.ready).toBe(false); expect(payload.blockers[0].actionLabel).toBe('Contact support');
  });
  it('starts or recovers missing onboarding instead of linking a nonexistent session', async () => {
    state.tables.onboarding_applications = table([]);
    expect((await request()).payload.blockers).toContainEqual(expect.objectContaining({ code: 'ONBOARDING_APPLICATION_REQUIRED', actionHref: '/onboarding/resume' }));
  });
  it('initializes onboarding when both company membership and application are absent', async () => {
    state.tables.profiles = table({ user_id: USER, company_id: null, role: 'customer', status: 'active' });
    state.tables.company_memberships = table([]); state.tables.onboarding_applications = table([]);
    expect((await request('')).payload.blockers).toContainEqual(expect.objectContaining({ code: 'ONBOARDING_COMPANY_LINK_REQUIRED', actionHref: '/onboarding/resume' }));
  });
  it('uses canonical driver operational blockers without changing eligibility', async () => {
    state.tables.drivers = table([{ id: 'driver-test', company_id: COMPANY, driver_type: 'owner_driver' }]);
    state.operational.mockResolvedValue({ eligible: false, blockers: ['canonical_vehicle_missing', 'commercial_bidding_not_permitted'] });
    const { payload } = await request(); expect(state.operational).toHaveBeenCalledWith(expect.anything(), 'driver-test');
    expect(payload.ready).toBe(false); expect(payload.blockers).toHaveLength(2);
    expect(payload.blockers.every((b: { actionType: string }) => b.actionType === 'link')).toBe(true);
  });
});

describe('recovery destination validation', () => {
  it.each(['https://evil.invalid', '//evil.invalid', 'javascript:alert(1)', '/driver\\evil', '/super-admin', '/driver\nother'])('rejects unsafe or privileged destination %s', (url) => { expect(isSafeRecoveryHref(url)).toBe(false); });
  it.each(['/driver/account/legal-agreements', '/onboarding/fleet/resume?document=insurance#onboarding-document-insurance', '/pending-approval'])('accepts known internal recovery %s', (url) => { expect(isSafeRecoveryHref(url)).toBe(true); });
  it('encodes the document target and grants company actions only to owner/admin membership', () => {
    expect(documentRecoveryHref('/onboarding/fleet/resume', 'a b')).toContain('document=a%20b');
    const context = resolveReadinessContext({ companyId: COMPANY, membershipRole: 'dispatcher', profileRole: 'company_admin' });
    expect(companyRecoveryAction(context, 'stripe').actionType).toBe('link');
  });
  it('keeps a verified owner-driver identity despite the legacy profile role driver', () => {
    expect(resolveReadinessContext({ companyId: COMPANY, membershipRole: 'owner', profileRole: 'driver', driverType: 'owner_driver' }).role).toBe('owner_driver');
  });
});
