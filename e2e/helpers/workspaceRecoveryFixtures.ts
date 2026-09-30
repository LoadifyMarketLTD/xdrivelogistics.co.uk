import type { Page } from '@playwright/test';

export const COMPANY = '11111111-1111-4111-8111-111111111111';
export const OTHER = '33333333-3333-4333-8333-333333333333';
export const USER = '22222222-2222-4222-8222-222222222222';
export const roots = { carrier: '/admin', customer: '/customer', broker: '/broker', owner: '/driver', driver: '/driver' } as const;

export async function mockWorkspace(page: Page, role: keyof typeof roots, billingFailure = false, personal = false, datasets: Record<string, unknown[]> = {}) {
  const company = { id: COMPANY, name: 'Fixture Carrier', trading_name: 'Fixture Carrier', xd_id: 'XD-TEST-001', status: 'active', company_type: 'carrier' };
  const authUser = { id: USER, email: 'workspace-fixture@example.invalid', role: 'authenticated', aud: 'authenticated', created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} };
  const membership = (id: string) => ({ id: `${id.slice(0, 8)}-membership`, company_id: id, user_id: USER, role_in_company: role === 'driver' ? 'driver' : 'owner', status: 'active', companies: { ...company, id } });
  await page.route('**/*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/v1/user')) return route.fulfill({ json: authUser });
    const name = url.pathname.split('/').pop();
    if (name === 'active_company_membership_role') return route.fulfill({ json: role === 'driver' ? 'driver' : 'owner' });
    let rows: unknown[] = [];
    if (name === 'profiles') rows = [{ user_id: USER, full_name: 'Fixture Operator', role: personal ? 'customer' : 'company_admin', status: 'active', is_driver: false, company_id: personal ? null : COMPANY, xd_id: 'XD-TEST-USER' }];
    if (name === 'companies') rows = personal ? [] : [company];
    // Auth requires one selected membership; billing receives an extra first row to test scoping.
    if (name === 'company_memberships') rows = personal ? [] : url.searchParams.get('select') === 'company_id,role_in_company,companies(name)' ? [membership(OTHER), membership(COMPANY)] : [membership(COMPANY)];
    if (name && Object.prototype.hasOwnProperty.call(datasets, name)) rows = datasets[name];
    const single = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ json: single ? rows[0] ?? null : rows });
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/workspace/readiness') return route.fulfill({ json: { ready: true, blockers: [] } });
    if (url.pathname === '/api/settings/company-finance') return route.fulfill({ json: { settings: {} } });
    if (url.pathname === '/api/jobs/create') return route.fulfill({ status: 409, json: { error: 'Current legal acceptance is required.', code: 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED', setupUrl: '/admin/settings/legal-agreements' } });
    if (url.pathname === '/api/billing/status') return route.fulfill({ status: billingFailure ? 503 : 200, json: billingFailure ? { error: 'Fixture billing unavailable' } : { delegated: role === 'driver', excluded: false, subscription: null } });
    return route.fulfill({ json: { memberships: [], current: null, notifications: [], unreadCount: 0 } });
  });
  await page.addInitScript(({ user, host }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture-only`;
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: token, refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
  }, { user: authUser, host: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname.split('.')[0] });
}
