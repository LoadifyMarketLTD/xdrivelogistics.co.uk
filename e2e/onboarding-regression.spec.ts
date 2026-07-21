import { expect, test, type Page, type Route } from '@playwright/test';
import { classifyAccessLifecycleStatus } from '../lib/accessLifecycle';

const SUPABASE_ORIGIN = 'https://placeholder.supabase.co';
const EMAIL = 'broker-regression@example.test';
const USER_ID = 'broker-regression-user';
const PASSWORD = 'SecurePass123!';

const jsonHeaders = {
  'access-control-allow-origin': '*',
  'content-type': 'application/json',
};

const fulfilJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({ status, headers: jsonHeaders, body: JSON.stringify(body) });
};

const requestJson = (route: Route): Record<string, unknown> => {
  const raw = route.request().postData();
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
};

const brokerMetadata = {
  role: 'broker',
  requested_role: 'broker',
  signup_type: 'broker',
  account_type: 'broker',
  workspace_mode: 'broker',
  owner_driver_workspace: false,
};

const authResponse = () => ({
  access_token: `access-${USER_ID}`,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: `refresh-${USER_ID}`,
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: EMAIL,
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmation_sent_at: null,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: brokerMetadata,
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

const fillLogin = async (page: Page, password: string) => {
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
};

test.describe('Registration and onboarding regressions', () => {
  test('canonical access mapping never classifies review states as suspended', () => {
    expect(classifyAccessLifecycleStatus('active')).toBe('active');
    expect(classifyAccessLifecycleStatus('pending')).toBe('pending');
    expect(classifyAccessLifecycleStatus('pending_approval')).toBe('pending');
    expect(classifyAccessLifecycleStatus('under_review')).toBe('pending');
    expect(classifyAccessLifecycleStatus('submitted')).toBe('pending');
    expect(classifyAccessLifecycleStatus('blocked')).toBe('blocked');
    expect(classifyAccessLifecycleStatus('suspended')).toBe('blocked');
    expect(classifyAccessLifecycleStatus('inactive')).toBe('blocked');
  });

  test('two invalid passwords do not suspend an under-review Broker', async ({ page }) => {
    let passwordAttempts = 0;

    await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
      passwordAttempts += 1;
      if (passwordAttempts <= 2) {
        await fulfilJson(route, {
          code: 'invalid_credentials',
          message: 'Invalid login credentials',
        }, 400);
        return;
      }
      await fulfilJson(route, authResponse());
    });

    await page.route('**/api/onboarding/init', async (route) => {
      await fulfilJson(route, {
        onboardingApplicationId: 'broker-under-review',
        status: 'under_review',
        accountType: 'broker',
        onboardingUrl: '/onboarding/resume',
        invitationRevoked: false,
        resumeAllowed: true,
      });
    });

    await page.goto('/login');

    await fillLogin(page, 'WrongPasswordOne!');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();

    await fillLogin(page, 'WrongPasswordTwo!');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();

    await fillLogin(page, PASSWORD);
    await page.waitForURL((url) => url.pathname === '/pending-approval', { timeout: 15_000 });
    await expect(page.getByText(/suspended/i)).toHaveCount(0);
    expect(passwordAttempts).toBe(3);
  });

  test('first confirmed Broker login creates missing onboarding from canonical metadata', async ({ page }) => {
    const initPayloads: Record<string, unknown>[] = [];
    let getCount = 0;

    await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
      await fulfilJson(route, authResponse());
    });

    await page.route('**/api/onboarding/init', async (route) => {
      if (route.request().method() === 'GET') {
        getCount += 1;
        await fulfilJson(route, { error: 'Onboarding application not found.' }, 404);
        return;
      }

      initPayloads.push(requestJson(route));
      await fulfilJson(route, {
        onboardingApplicationId: 'broker-created-on-login',
        status: 'draft',
        accountType: 'broker',
        onboardingUrl: '/onboarding/resume',
        invitationRevoked: false,
        resumeAllowed: true,
      });
    });

    await page.route('**/api/onboarding/broker/session**', async (route) => {
      await fulfilJson(route, {
        resumable: true,
        application: {
          id: 'broker-created-on-login',
          user_id: USER_ID,
          account_type: 'broker_shipper',
          status: 'draft',
          current_step: 'account_type_wizard',
          completion_percentage: 5,
          payload: {},
        },
      });
    });

    await page.goto('/login');
    await fillLogin(page, PASSWORD);

    await page.waitForURL((url) => url.pathname === '/onboarding/broker/resume', { timeout: 15_000 });
    expect(getCount).toBeGreaterThanOrEqual(1);
    expect(initPayloads).toContainEqual({
      account_type: 'broker',
      forceRegenerateToken: false,
    });
  });
});
