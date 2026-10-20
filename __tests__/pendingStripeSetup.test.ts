import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { stripeSetupAccessMode } from '../app/api/_lib/stripeSetupAccess';

const state = vi.hoisted(() => ({
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  company: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  user: null as { id: string; email: string } | null,
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{ table: string; value: Record<string, unknown> }>,
  queries: [] as Array<{ table: string; filters: unknown[][] }>,
  stripe: vi.fn(), dbError: '' as string,
}));
vi.mock('../app/api/_lib/stripeServer', () => ({ isStripeServerConfigured: true, stripeRequest: state.stripe }));
vi.mock('../lib/siteUrl', () => ({ getCanonicalSiteOrigin: () => 'https://www.xdrivelogistics.co.uk' }));
vi.mock('../app/api/_lib/supabaseAdmin', () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from(table: string) {
      const filters: unknown[][] = []; state.queries.push({ table, filters });
      const result = (single: boolean) => {
        const values = (state.tables[table] ?? []).filter(row => filters.every(([op,key,value]) =>
          op === 'eq' ? row[String(key)] === value : (value as unknown[]).includes(row[String(key)])));
        return { data: single ? values[0] ?? null : values,
          error: state.dbError === table ? { code: 'XX000', message: 'Database unavailable' } : null };
      };
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.push(['eq',key,value]); return chain; },
        in: (key: string, value: unknown[]) => { filters.push(['in',key,value]); return chain; },
        maybeSingle: async () => result(true),
        upsert: async (value: Record<string, unknown>) => { state.writes.push({ table, value }); return { error: null }; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result(false)).then(resolve),
      }; return chain;
    },
  };
  return { isSupabaseAdminConfigured: true, supabaseAdmin: client, supabaseValidator: client,
    getBearerToken: (request: Request) => request.headers.get('authorization')?.replace('Bearer ', '') ?? null };
});
import { GET, POST } from '../app/api/payments/connect/onboarding/route';
const request = (action: 'start' | 'refresh' = 'start', companyId = state.company, authorized = true) =>
  new NextRequest('https://example.test/api/payments/connect/onboarding', { method: 'POST',
    headers: { ...(authorized ? { Authorization: 'Bearer test' } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, action }),
  });

beforeEach(() => {
  state.user = { id: state.actor, email: 'owner@example.test' }; state.dbError = ''; state.writes = []; state.queries = [];
  state.tables = {
    profiles: [{ user_id: state.actor, status: 'pending' }],
    company_memberships: [{ user_id: state.actor, company_id: state.company, role_in_company: 'owner', status: 'invited' }],
    companies: [{ id: state.company, name: 'Pending Transport', status: 'pending_approval', created_by: state.actor }],
    onboarding_applications: [{ user_id: state.actor, company_id: state.company, account_type: 'owner_driver', status: 'under_review', risk_status: 'clear' }],
    stripe_connected_accounts: [],
  };
  state.stripe.mockReset().mockImplementation(async (path: string) => path === '/account_links'
    ? { url: 'https://connect.stripe.com/setup/test', expires_at: 123 }
    : { id: 'acct_fixture', details_submitted: false, charges_enabled: false, payouts_enabled: false });
});

describe('pending company Stripe setup - limited authority', () => {
  it.each(['owner_driver', 'fleet_courier', 'broker_shipper', 'customer_shipper'])('allows only its own pending %s company', async type => {
    state.tables.onboarding_applications[0].account_type = type;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).onboardingUrl).toBe('https://connect.stripe.com/setup/test');
    expect(state.writes.map(w => w.table)).toEqual(['stripe_connected_accounts']);
    expect(state.tables.profiles[0].status).toBe('pending');
    expect(state.tables.company_memberships[0].status).toBe('invited');
    expect(state.tables.companies[0].status).toBe('pending_approval');
  });
  it('lists the same scoped company without creating Stripe links or changing state', async () => {
    const response = await GET(new NextRequest('https://example.test/api/payments/connect/onboarding', { headers: { Authorization: 'Bearer test' } }));
    expect(response.status).toBe(200);
    expect((await response.json()).companies).toEqual([{ companyId: state.company, name: 'Pending Transport', role: 'owner', preApproval: true, stripeReady: false, onboardingStatus: 'not_started' }]);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(state.stripe).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
    expect(state.queries.filter(q => ['company_memberships','onboarding_applications','profiles'].includes(q.table)).every(q => q.filters.some(f => f[0] === 'eq' && f[1] === 'user_id' && f[2] === state.actor))).toBe(true);
  });
  it('requires authentication for discovery and link creation', async () => {
    expect((await GET(new NextRequest('https://example.test/api/payments/connect/onboarding'))).status).toBe(401);
    expect((await POST(request('start', state.company, false))).status).toBe(401);
    state.user = null; expect((await POST(request())).status).toBe(401);
    expect(state.stripe).not.toHaveBeenCalled();
  });
  it('refuses an arbitrary foreign company id before contacting Stripe', async () => {
    expect((await POST(request('start','cccccccc-cccc-4ccc-8ccc-cccccccccccc'))).status).toBe(403);
    expect(state.stripe).not.toHaveBeenCalled();
  });
  const rejected: Array<[string, string, string, unknown]> = [
    ['ordinary driver', 'company_memberships','role_in_company','driver'],
    ['dispatcher', 'company_memberships','role_in_company','dispatcher'],
    ['unaccepted invitation to someone else company', 'companies','created_by','someone-else'],
    ['company driver account', 'onboarding_applications','account_type','individual_driver'],
    ['unbound application', 'onboarding_applications','company_id',null],
    ['rejected application', 'onboarding_applications','status','rejected'],
    ['held application', 'onboarding_applications','risk_status','hold'],
    ['fraud blocked', 'onboarding_applications','risk_status','confirmed_fraud'],
    ['suspended profile', 'profiles','status','suspended'],
    ['unknown profile', 'profiles','status','unknown'],
    ['suspended membership', 'company_memberships','status','suspended'],
    ['suspended company', 'companies','status','suspended'],
    ['rejected company', 'companies','status','rejected'],
  ];
  it.each(rejected)('fails closed for %s', async (_name,table,key,value) => {
    state.tables[table][0][key] = value;
    expect((await POST(request())).status).toBe(403); expect(state.stripe).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
  });
  it('does not infer pending ownership from a creator id alone', async () => {
    state.tables.company_memberships = [];
    expect((await POST(request())).status).toBe(403);
  });
  it('rejects ambiguous application binding', async () => {
    state.tables.onboarding_applications.push({ ...state.tables.onboarding_applications[0] });
    expect((await POST(request())).status).toBe(403);
  });
  it('preserves active owner and admin setup', async () => {
    state.tables.profiles[0].status = 'active'; state.tables.companies[0].status = 'active';
    state.tables.company_memberships[0].status = 'active'; state.tables.company_memberships[0].role_in_company = 'admin';
    state.tables.onboarding_applications = [];
    expect((await POST(request())).status).toBe(200);
  });
  it('does not create an account when refreshing an unconnected company', async () => {
    const response = await POST(request('refresh')); expect(response.status).toBe(200);
    expect((await response.json()).stripeReady).toBe(false);
    expect(state.stripe).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
  });
  it('rechecks Stripe after return, never trusts URL success or posted readiness flags', async () => {
    state.tables.stripe_connected_accounts = [{ company_id: state.company, stripe_account_id: 'acct_existing' }];
    state.stripe.mockResolvedValue({ id: 'acct_existing', details_submitted: true, charges_enabled: true, payouts_enabled: true });
    const response = await POST(request('refresh')); expect(response.status).toBe(200);
    expect((await response.json()).stripeReady).toBe(true);
    expect(state.stripe).toHaveBeenCalledTimes(1);
    expect(state.stripe).toHaveBeenCalledWith('/accounts/acct_existing', { method: 'GET' });
    expect(state.writes[0].value).toMatchObject({ onboarding_status: 'enabled', charges_enabled: true, payouts_enabled: true });
  });
  it('fails closed when company authority lookup fails', async () => {
    state.dbError = 'onboarding_applications';
    expect((await POST(request())).status).toBeGreaterThanOrEqual(500); expect(state.stripe).not.toHaveBeenCalled();
  });
  it('never weakens commercial readiness or approval gates', () => {
    const approval = readFileSync('app/api/super-admin/onboarding/[id]/route.ts','utf8');
    const queue = readFileSync('app/api/super-admin/onboarding/route.ts','utf8');
    expect(approval).toContain('getStripeCommercialReadiness');
    expect(queue).toContain('getStripeCommercialReadiness(admin, companyId)');
    expect(queue).toContain('Stripe setup required:');
    expect(queue).toContain('ready_for_approval: approvalBlockers.length === 0');
  });
  it('does not grant setup permission when profile status is missing', () => {
    expect(stripeSetupAccessMode(state.actor, null, { company_id: state.company, role_in_company: 'owner', status: 'active' },
      { id: state.company, name: 'Test', created_by: state.actor, status: 'active' }, [])).toBeNull();
  });
});
