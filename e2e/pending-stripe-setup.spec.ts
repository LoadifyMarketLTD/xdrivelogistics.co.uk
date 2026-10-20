import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
let admin: SupabaseClient;
let userId = '';
let companyId = '';
let applicationId = '';
const suffix = randomUUID();
const email = `pending-stripe-${suffix}@example.test`;
const password = randomUUID() + '!Xdrive9';
const companyName = 'Synthetic Pending Stripe ' + suffix;

// This suite uses real auth/DB plus READ/refresh-no-account endpoints. It never
// calls Stripe account/link creation and never modifies a real applicant.
test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing E2E server configuration.');
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (auth.error || !auth.data.user) throw new Error(auth.error?.message ?? 'Synthetic identity creation failed.');
  userId = auth.data.user.id;
  const company = await admin.from('companies').insert({ name: companyName, created_by: userId, company_type: 'owner_driver', status: 'pending_approval' }).select('id').single();
  if (company.error) throw new Error(company.error.message);
  companyId = company.data.id;
  const profile = await admin.from('profiles').update({ role: 'driver', status: 'pending', company_id: companyId }).eq('user_id', userId);
  if (profile.error) throw new Error(profile.error.message);
  // Linking a profile to a company may already create its canonical application.
  const app = await admin.from('onboarding_applications').upsert({ user_id: userId, email, company_id: companyId,
    account_type: 'owner_driver', status: 'under_review', current_step: 'pending_review', completion_percentage: 100,
    submitted_at: new Date().toISOString(), payload: { full_name: 'Synthetic Pending Stripe' }, risk_status: 'clear',
  }, { onConflict: 'user_id' }).select('id').single();
  if (app.error) throw new Error(app.error.message);
  applicationId = app.data.id;
  const membership = await admin.from('company_memberships').upsert({ company_id: companyId, user_id: userId, role_in_company: 'owner', status: 'invited' }, { onConflict: 'company_id,user_id' });
  if (membership.error) throw new Error(membership.error.message);
});

test.afterAll(async () => {
  if (!admin || !userId) return;
  const errors: string[] = [];
  // Cleanup must also work if a database trigger created the application before
  // beforeAll could record its id.
  const result = await admin.from('onboarding_applications').delete().eq('user_id', userId).eq('email', email);
  if (result.error) errors.push(result.error.message);
  if (companyId) {
    const members = await admin.from('company_memberships').delete().eq('company_id', companyId).eq('user_id', userId);
    if (members.error) errors.push(members.error.message);
    const profile = await admin.from('profiles').update({ company_id: null }).eq('user_id', userId);
    if (profile.error) errors.push(profile.error.message);
    const company = await admin.from('companies').delete().eq('id', companyId).eq('created_by', userId);
    if (company.error) errors.push(company.error.message);
  }
  const removed = await admin.auth.admin.deleteUser(userId);
  if (removed.error) errors.push(removed.error.message);
  if (errors.length) throw new Error('Synthetic cleanup: ' + errors.join('; '));
});

for (const width of [390, 1440]) {
  test(`pending owner reaches own Stripe setup at ${width}px without activation`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login?next=%2Fsettings%2Fpayments');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/settings\/payments$/, { timeout: 60000 });
    await expect(page.getByRole('heading', { name: companyName })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Pre-approval payment setup.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Stripe', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Check Stripe status' }).click();
    await expect(page.getByRole('status')).toContainText('not fully active yet', { timeout: 30000 });
    await page.reload();
    await expect(page.getByRole('heading', { name: companyName })).toBeVisible({ timeout: 30000 });
    const denied = await page.evaluate(async (foreignCompanyId) => {
      const item = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith('xdrive-route-access-token='));
      if (!item) throw new Error('No authenticated route cookie.');
      const token = decodeURIComponent(item.slice(item.indexOf('=') + 1));
      const response = await fetch('/api/payments/connect/onboarding', { method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: foreignCompanyId, action: 'start' }),
      });
      return response.status;
    }, randomUUID());
    expect(denied).toBe(403);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto('/driver/loads');
    await expect(page).not.toHaveURL(/\/driver\/loads$/);
    const [profile, company, membership, app, stripe] = await Promise.all([
      admin.from('profiles').select('status').eq('user_id', userId).single(),
      admin.from('companies').select('status').eq('id', companyId).single(),
      admin.from('company_memberships').select('status').eq('company_id', companyId).eq('user_id', userId).single(),
      admin.from('onboarding_applications').select('status').eq('id', applicationId).single(),
      admin.from('stripe_connected_accounts').select('company_id').eq('company_id', companyId),
    ]);
    expect(profile.data?.status).toBe('pending'); expect(company.data?.status).toBe('pending_approval');
    expect(membership.data?.status).toBe('invited'); expect(app.data?.status).toBe('under_review');
    expect(stripe.error).toBeNull(); expect(stripe.data).toHaveLength(0);
  });
}

test('Stripe setup refuses unauthenticated discovery and writes', async ({ request }) => {
  expect((await request.get('/api/payments/connect/onboarding')).status()).toBe(401);
  expect((await request.post('/api/payments/connect/onboarding', { data: { companyId } })).status()).toBe(401);
});
