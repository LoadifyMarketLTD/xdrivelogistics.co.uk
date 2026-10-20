import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// A dedicated, disposable pending identity exercises the real login and API.
// No existing applicant, document, permission or approval is changed.
test.describe.configure({ mode: 'serial' });
let admin: SupabaseClient;
let userId: string;
const email = `pending-login-${randomUUID()}@example.test`;
const password = randomUUID() + '!Xdrive9';

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Pending-login E2E server environment is missing.');
  admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? 'Could not create E2E identity.');
  userId = created.data.user.id;
  const profile = await admin.from('profiles').update({ role: 'driver', status: 'pending' }).eq('user_id', userId);
  if (profile.error) throw new Error(profile.error.message);
  const app = await admin.from('onboarding_applications').insert({ user_id: userId, email,
    account_type: 'owner_driver', status: 'under_review', current_step: 'pending_review',
    completion_percentage: 100, submitted_at: new Date().toISOString(), payload: { full_name: 'Synthetic Pending Login Check' },
  });
  if (app.error) throw new Error(app.error.message);
});

test.afterAll(async () => {
  if (!userId || !admin) return;
  const removed = await admin.from('onboarding_applications').delete().eq('user_id', userId).eq('email', email);
  if (removed.error) throw new Error('Synthetic onboarding cleanup failed: ' + removed.error.message);
  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) throw new Error('Synthetic Auth cleanup failed: ' + deleted.error.message);
});

for (const width of [390, 1440]) {
  test(`real pending login reaches own documents without workspace access at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/pending-approval$/, { timeout: 60000 });
    await page.getByRole('link', { name: 'View or replace my documents' }).click();
    await expect(page).toHaveURL(/\/onboarding\/documents$/);
    await expect(page.getByRole('heading', { name: 'My onboarding documents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload Right-to-work evidence' })).toBeVisible({ timeout: 20000 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Upload Right-to-work evidence' })).toBeVisible({ timeout: 20000 });
    // A pending session is not an operational authorization.
    await page.goto('/driver/loads');
    await expect(page).not.toHaveURL(/\/driver\/loads$/);
    const { data: after } = await admin.from('profiles').select('status').eq('user_id', userId).single();
    expect(after?.status).toBe('pending');
    const { data: app } = await admin.from('onboarding_applications').select('status').eq('user_id', userId).single();
    expect(app?.status).toBe('under_review');
  });
}
