import { expect, test } from '@playwright/test';

const absentId = '00000000-0000-4000-8000-000000000000';

for (const [role, prefix] of [['Owner Driver', 'E2E_OWNER_DRIVER'], ['Company Driver', 'E2E_COMPANY_DRIVER']] as const) {
  test(`${role} authenticated PWA mutations cannot alter nonexistent work`, async ({ request }) => {
    test.setTimeout(90000);
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!email || !password || !url || !key, 'Authorised test account and Supabase configuration required');
    const auth = await request.post(`${url}/auth/v1/token?grant_type=password`, { headers: { apikey: key! }, data: { email, password } });
    expect(auth.ok(), 'Test-account authentication must succeed').toBe(true);
    const accessToken = (await auth.json() as { access_token?: string }).access_token;
    expect(accessToken).toBeTruthy();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const cases = [
      { path: `/api/driver/web/bids/${absentId}`, data: { action: 'withdraw' } },
      { path: `/api/driver/web/bids/${absentId}`, data: { action: 'edit', amount: 100 } },
      { path: `/api/driver/web/jobs/${absentId}/loaded`, data: {} },
      { path: `/api/driver/web/jobs/${absentId}/delivered`, data: {} },
      { path: `/api/driver/web/jobs/${absentId}/pod`, data: {} },
    ];
    for (const item of cases) {
      const response = await request.post(item.path, { headers, data: item.data });
      expect([400, 403, 404, 409, 503], `${role} ${item.path}: HTTP ${response.status()}`).toContain(response.status());
    }
  });
}
