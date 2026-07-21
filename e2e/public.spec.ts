import { test, expect, type Page, type Route } from '@playwright/test';
import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPES,
  toStoredOnboardingAccountType,
  type AccountAppRole,
  type AccountType,
  type AccountWorkspaceMode,
  type StoredOnboardingAccountType,
} from '../lib/accountTypes';

const SUPABASE_ORIGIN = 'https://placeholder.supabase.co';
const TEST_PASSWORD = 'SecurePass123!';

type PublicRoleCase = {
  label: string;
  selectorValue: AccountType;
  appRole: AccountAppRole;
  accountType: AccountType;
  storedAccountType: StoredOnboardingAccountType;
  workspaceMode: AccountWorkspaceMode;
  onboardingPath: string;
};

const PUBLIC_ROLE_CASES: PublicRoleCase[] = ACCOUNT_TYPES.map((accountType) => {
  const config = ACCOUNT_TYPE_CONFIG[accountType];
  return {
    label: config.label,
    selectorValue: accountType,
    appRole: config.appRole,
    accountType,
    storedAccountType: toStoredOnboardingAccountType(accountType),
    workspaceMode: config.workspaceMode,
    onboardingPath: config.onboardingPath,
  };
});

const jsonHeaders = {
  'access-control-allow-origin': '*',
  'content-type': 'application/json',
};

const buildAuthResponse = ({
  email,
  userId,
  userMetadata,
}: {
  email: string;
  userId: string;
  userMetadata: Record<string, unknown>;
}) => ({
  access_token: `access-${userId}`,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: `refresh-${userId}`,
  user: {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmation_sent_at: null,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: userMetadata,
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

const fulfilJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({ status, headers: jsonHeaders, body: JSON.stringify(body) });
};

const requestJson = (route: Route): Record<string, unknown> => {
  const raw = route.request().postData();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
};

const mockPostgrestForPendingProfile = async (page: Page, roleCase: PublicRoleCase) => {
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: jsonHeaders });
      return;
    }

    if (table === 'profiles' && request.method() !== 'GET') {
      await route.fulfill({ status: 201, headers: jsonHeaders, body: '' });
      return;
    }

    if (table === 'profiles') {
      await fulfilJson(route, {
        role: roleCase.appRole,
        status: 'pending',
        is_driver: roleCase.appRole === 'driver',
        company_id: null,
      });
      return;
    }

    if (table === 'company_memberships') {
      await fulfilJson(route, []);
      return;
    }

    if (table === 'drivers' || table === 'companies') {
      await fulfilJson(route, null);
      return;
    }

    await fulfilJson(route, []);
  });
};

const mockOnboardingBrowserApis = async (
  page: Page,
  roleCase: PublicRoleCase,
  status: 'draft' | 'in_progress' | 'under_review' = 'draft',
  onInitRequest?: (payload: Record<string, unknown>) => void
) => {
  const application = {
    id: `application-${roleCase.accountType}`,
    user_id: `user-${roleCase.accountType}`,
    account_type: roleCase.storedAccountType,
    status,
    current_step: 'account_type_wizard',
    completion_percentage: 5,
    payload: {},
  };

  await page.route('**/api/onboarding/init', async (route) => {
    onInitRequest?.(requestJson(route));
    await fulfilJson(route, {
      onboardingApplicationId: application.id,
      status,
      accountType: roleCase.accountType,
      onboardingUrl: '/onboarding/resume',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      invitationRevoked: false,
      resumeAllowed: true,
    });
  });

  await page.route('**/api/onboarding/customer/session**', async (route) => {
    await fulfilJson(route, { application, resumable: true });
  });
  await page.route('**/api/onboarding/broker/session**', async (route) => {
    await fulfilJson(route, { application, resumable: true });
  });
  await page.route('**/api/onboarding/session**', async (route) => {
    await fulfilJson(route, { application, resumable: true });
  });
};

const registerRole = async (page: Page, roleCase: PublicRoleCase) => {
  const email = `${roleCase.accountType}@example.test`;
  const userId = `user-${roleCase.accountType}`;
  let capturedMetadata: Record<string, unknown> | null = null;
  let capturedInitPayload: Record<string, unknown> | null = null;

  await mockPostgrestForPendingProfile(page, roleCase);
  await mockOnboardingBrowserApis(page, roleCase, 'draft', (payload) => {
    capturedInitPayload = payload;
  });

  await page.route(`${SUPABASE_ORIGIN}/auth/v1/signup**`, async (route) => {
    const requestBody = requestJson(route);
    capturedMetadata = (requestBody.data ?? {}) as Record<string, unknown>;
    await fulfilJson(route, buildAuthResponse({ email, userId, userMetadata: capturedMetadata }));
  });

  await page.goto('/register');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-role').selectOption(roleCase.selectorValue);
  await page.locator('#register-password').fill(TEST_PASSWORD);
  await page.locator('#register-password-confirm').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create account and continue' }).click();

  await page.waitForURL((url) => url.pathname === roleCase.onboardingPath, { timeout: 15_000 });

  expect(capturedMetadata).toMatchObject({
    role: roleCase.appRole,
    requested_role: roleCase.accountType,
    signup_type: roleCase.accountType,
    account_type: roleCase.accountType,
    workspace_mode: roleCase.workspaceMode,
    owner_driver_workspace: roleCase.accountType === 'owner_driver',
  });

  expect(capturedInitPayload).toEqual({
    account_type: roleCase.accountType,
    forceRegenerateToken: false,
  });
};

const mockPasswordLogin = async (
  page: Page,
  {
    email,
    userId,
    userMetadata,
  }: {
    email: string;
    userId: string;
    userMetadata: Record<string, unknown>;
  }
) => {
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
    expect(route.request().url()).toContain('grant_type=password');
    await fulfilJson(route, buildAuthResponse({ email, userId, userMetadata }));
  });
};

// ── Public pages ─────────────────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/XDrive/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('homepage has navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('request-quote page loads', async ({ page }) => {
    await page.goto('/request-quote');
    await expect(page.locator('form, [data-testid="quote-form"]')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('registration exposes only the four canonical public account types', async ({ page }) => {
    await page.goto('/register');
    const accountType = page.locator('#register-role');
    await expect(accountType).toBeVisible();
    await expect(accountType.locator('option')).toHaveCount(4);

    const optionValues = await accountType.locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(optionValues).toEqual([...ACCOUNT_TYPES]);

    await expect(accountType).toContainText('Customer / Shipper');
    await expect(accountType).toContainText('Transport Broker');
    await expect(accountType).toContainText('Fleet Operator');
    await expect(accountType).toContainText('Owner Driver');
    await expect(accountType).not.toContainText('Fleet Driver');
  });
});

// ── Registration role routing ────────────────────────────────────────────────

test.describe('Registration and onboarding role routing', () => {
  for (const roleCase of PUBLIC_ROLE_CASES) {
    test(`${roleCase.label} sends canonical account_type and opens the correct onboarding`, async ({ page }) => {
      await registerRole(page, roleCase);
    });
  }

  test('an existing Broker with incomplete onboarding resumes Broker onboarding after login', async ({ page }) => {
    const roleCase = PUBLIC_ROLE_CASES.find((item) => item.accountType === 'broker')!;
    const email = 'existing-broker@example.test';
    const userMetadata = {
      role: roleCase.appRole,
      account_type: roleCase.accountType,
      requested_role: roleCase.accountType,
      workspace_mode: roleCase.workspaceMode,
    };

    await mockPostgrestForPendingProfile(page, roleCase);
    await mockOnboardingBrowserApis(page, roleCase, 'in_progress');
    await mockPasswordLogin(page, { email, userId: 'existing-broker', userMetadata });

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL((url) => url.pathname === roleCase.onboardingPath, { timeout: 15_000 });
  });

  test('an account under review is sent to Pending Approval after login', async ({ page }) => {
    const roleCase = PUBLIC_ROLE_CASES.find((item) => item.accountType === 'fleet_operator')!;
    const email = 'fleet-under-review@example.test';
    const userMetadata = {
      role: roleCase.appRole,
      account_type: roleCase.accountType,
      requested_role: roleCase.accountType,
      workspace_mode: roleCase.workspaceMode,
    };

    await mockPostgrestForPendingProfile(page, roleCase);
    await mockOnboardingBrowserApis(page, roleCase, 'under_review');
    await mockPasswordLogin(page, { email, userId: 'fleet-under-review', userMetadata });

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL((url) => url.pathname === '/pending-approval', { timeout: 15_000 });
  });
});

// ── Auth redirect ────────────────────────────────────────────────────────────

test.describe('Auth redirects', () => {
  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated /driver/jobs redirects to login', async ({ page }) => {
    await page.goto('/driver/jobs');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated /super-admin redirects to login', async ({ page }) => {
    await page.goto('/super-admin');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated /customer redirects to login', async ({ page }) => {
    await page.goto('/customer');
    await page.waitForURL(url => /login|auth|\/$/i.test(url.pathname), { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });

  test('unauthenticated onboarding resume redirects to login with return path', async ({ page }) => {
    await page.goto('/onboarding/resume');
    await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('next') === '/onboarding/resume', { timeout: 8_000 });
    await expect(page.locator('input[type="email"], [data-testid="email"]')).toBeVisible();
  });
});
