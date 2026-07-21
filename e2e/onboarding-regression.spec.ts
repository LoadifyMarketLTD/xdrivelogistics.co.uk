import { expect, test, type Page, type Route } from '@playwright/test';
import {
  classifyAccessLifecycleStatus,
  classifyOnboardingLifecycleStatus,
} from '../lib/accessLifecycle';
import { ownerDriverPayloadSchema } from '../app/api/onboarding/_lib/schemas';

const SUPABASE_ORIGIN = 'https://placeholder.supabase.co';
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

type CanonicalAccountType = 'broker' | 'fleet_operator' | 'owner_driver';

const metadataFor = (accountType: CanonicalAccountType) => {
  if (accountType === 'broker') {
    return {
      role: 'broker',
      requested_role: 'broker',
      signup_type: 'broker',
      account_type: 'broker',
      workspace_mode: 'broker',
      owner_driver_workspace: false,
    };
  }
  if (accountType === 'fleet_operator') {
    return {
      role: 'company_admin',
      requested_role: 'fleet_operator',
      signup_type: 'fleet_operator',
      account_type: 'fleet_operator',
      workspace_mode: 'company',
      owner_driver_workspace: false,
    };
  }
  return {
    role: 'driver',
    requested_role: 'owner_driver',
    signup_type: 'owner_driver',
    account_type: 'owner_driver',
    workspace_mode: 'owner_driver',
    owner_driver_workspace: true,
  };
};

const authResponse = ({
  accountType = 'broker',
  email = 'broker-regression@example.test',
  userId = 'broker-regression-user',
}: {
  accountType?: CanonicalAccountType;
  email?: string;
  userId?: string;
} = {}) => ({
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
    user_metadata: metadataFor(accountType),
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

const fillLogin = async (page: Page, email: string, password: string) => {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
};

const mockSuccessfulLogin = async (
  page: Page,
  options: Parameters<typeof authResponse>[0]
) => {
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
    await fulfilJson(route, authResponse(options));
  });
};

const mockOnboardingInit = async (
  page: Page,
  accountType: CanonicalAccountType,
  status: 'draft' | 'in_progress' | 'request_changes' | 'under_review' = 'draft'
) => {
  await page.route('**/api/onboarding/init', async (route) => {
    await fulfilJson(route, {
      onboardingApplicationId: `${accountType}-application`,
      status,
      accountType,
      onboardingUrl: '/onboarding/resume',
      invitationRevoked: false,
      resumeAllowed: true,
    });
  });
};

test.describe('Registration and onboarding regressions', () => {
  test('canonical lifecycle mapping never classifies review states as suspended', () => {
    expect(classifyAccessLifecycleStatus('active')).toBe('active');
    expect(classifyAccessLifecycleStatus('pending')).toBe('pending');
    expect(classifyAccessLifecycleStatus('pending_approval')).toBe('pending');
    expect(classifyAccessLifecycleStatus('under_review')).toBe('pending');
    expect(classifyAccessLifecycleStatus('submitted')).toBe('pending');
    expect(classifyAccessLifecycleStatus('blocked')).toBe('blocked');
    expect(classifyAccessLifecycleStatus('suspended')).toBe('blocked');
    expect(classifyAccessLifecycleStatus('inactive')).toBe('blocked');

    expect(classifyOnboardingLifecycleStatus('draft')).toBe('editable');
    expect(classifyOnboardingLifecycleStatus('request_changes')).toBe('editable');
    expect(classifyOnboardingLifecycleStatus('under_review')).toBe('review');
    expect(classifyOnboardingLifecycleStatus('approved')).toBe('approved');
    expect(classifyOnboardingLifecycleStatus('rejected')).toBe('rejected');
  });

  test('two invalid passwords do not suspend an under-review Broker', async ({ page }) => {
    const email = 'broker-regression@example.test';
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
      await fulfilJson(route, authResponse({ email }));
    });

    await mockOnboardingInit(page, 'broker', 'under_review');
    await page.goto('/login');

    await fillLogin(page, email, 'WrongPasswordOne!');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();

    await fillLogin(page, email, 'WrongPasswordTwo!');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();

    await fillLogin(page, email, PASSWORD);
    await page.waitForURL((url) => url.pathname === '/pending-approval', { timeout: 15_000 });
    await expect(page.getByText(/suspended/i)).toHaveCount(0);
    expect(passwordAttempts).toBe(3);
  });

  test('first confirmed Broker login creates missing onboarding from canonical metadata', async ({ page }) => {
    const email = 'new-broker@example.test';
    const initPayloads: Record<string, unknown>[] = [];
    let getCount = 0;

    await mockSuccessfulLogin(page, { email });

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
          user_id: 'broker-regression-user',
          account_type: 'broker_shipper',
          status: 'draft',
          current_step: 'account_type_wizard',
          completion_percentage: 5,
          payload: {},
        },
      });
    });

    await page.goto('/login');
    await fillLogin(page, email, PASSWORD);

    await page.waitForURL((url) => url.pathname === '/onboarding/broker/resume', { timeout: 15_000 });
    expect(getCount).toBeGreaterThanOrEqual(1);
    expect(initPayloads).toContainEqual({
      account_type: 'broker',
      forceRegenerateToken: false,
    });
  });

  test('Owner Driver uses canonical required fields and submits to Pending Approval', async ({ page }) => {
    const email = 'owner-driver-regression@example.test';
    await mockSuccessfulLogin(page, {
      accountType: 'owner_driver',
      email,
      userId: 'owner-driver-regression-user',
    });
    await mockOnboardingInit(page, 'owner_driver', 'draft');

    const application = {
      id: 'owner-driver-application',
      user_id: 'owner-driver-regression-user',
      account_type: 'owner_driver',
      status: 'draft',
      current_step: 'account_type_wizard',
      completion_percentage: 5,
      payload: {},
    };

    await page.route('**/api/onboarding/session**', async (route) => {
      await fulfilJson(route, { application, resumable: true });
    });
    await page.route('**/api/onboarding/owner-driver/session', async (route) => {
      const payload = requestJson(route).payload ?? {};
      await fulfilJson(route, {
        application: { ...application, status: 'in_progress', completion_percentage: 100, payload },
      });
    });
    await page.route('**/api/onboarding/submit/owner-driver', async (route) => {
      await fulfilJson(route, {
        application: { ...application, status: 'under_review', completion_percentage: 100 },
      });
    });

    await page.goto('/login');
    await fillLogin(page, email, PASSWORD);
    await page.waitForURL((url) => url.pathname === '/onboarding/owner-driver/resume', { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Owner Driver Onboarding' })).toBeVisible();
    await expect(page.getByLabel(/Date of Birth/)).toBeVisible();
    await expect(page.getByLabel(/National Insurance Number/)).toBeVisible();
    await expect(page.getByLabel(/Driving Licence Number/)).toBeVisible();

    await page.getByLabel(/Full Name/).fill('Test Owner Driver');
    await page.getByLabel(/Date of Birth/).fill('1990-01-15');
    await page.getByLabel(/Home Address/).fill('1 Test Street, Blackburn');
    await page.getByLabel(/^Phone/).fill('07123456789');
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/National Insurance Number/).fill('QQ123456C');
    await page.getByLabel(/Right to Work Status/).fill('settled');
    await page.getByLabel(/Driving Licence Number/).fill('TEST123456789');
    await page.getByLabel(/Driving Licence Expiry/).fill('2030-01-15');
    await page.getByLabel(/Vehicle Registration/).fill('AB12 CDE');
    await page.getByLabel(/Vehicle Make/).fill('Mercedes-Benz');
    await page.getByLabel(/Vehicle Model/).fill('Sprinter');
    await page.getByLabel(/Vehicle Payload/).fill('1000 kg');
    await page.getByLabel(/Vehicle Dimensions/).fill('4m x 2m x 2m');

    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.waitForURL((url) => url.pathname === '/pending-approval', { timeout: 15_000 });
  });

  test('old Owner Driver dob payload is rejected while canonical date_of_birth is accepted', () => {
    const canonicalPayload = {
      full_name: 'Test Owner Driver',
      date_of_birth: '1990-01-15',
      address: '1 Test Street',
      contact_phone: '07123456789',
      contact_email: 'owner@example.test',
      national_insurance_number: 'QQ123456C',
      right_to_work_status: 'settled',
      licence_number: 'TEST123456789',
      licence_expiry: '2030-01-15',
      registration: 'AB12 CDE',
      make: 'Mercedes-Benz',
      model: 'Sprinter',
      payload: '1000 kg',
      dimensions: '4m x 2m x 2m',
    };

    expect(ownerDriverPayloadSchema.safeParse(canonicalPayload).success).toBe(true);
    expect(ownerDriverPayloadSchema.safeParse({
      ...canonicalPayload,
      date_of_birth: undefined,
      dob: '1990-01-15',
    }).success).toBe(false);
  });

  test('Fleet Operator opens only the fleet onboarding fields', async ({ page }) => {
    const email = 'fleet-regression@example.test';
    await mockSuccessfulLogin(page, {
      accountType: 'fleet_operator',
      email,
      userId: 'fleet-regression-user',
    });
    await mockOnboardingInit(page, 'fleet_operator', 'draft');

    await page.route('**/api/onboarding/session**', async (route) => {
      await fulfilJson(route, {
        resumable: true,
        application: {
          id: 'fleet-application',
          user_id: 'fleet-regression-user',
          account_type: 'fleet_courier',
          status: 'draft',
          current_step: 'account_type_wizard',
          completion_percentage: 5,
          payload: {},
        },
      });
    });

    await page.goto('/login');
    await fillLogin(page, email, PASSWORD);
    await page.waitForURL((url) => url.pathname === '/onboarding/fleet/resume', { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Fleet Operator Onboarding' })).toBeVisible();
    await expect(page.getByLabel(/Legal Company Name/)).toBeVisible();
    await expect(page.getByLabel(/Transport Contact/)).toBeVisible();
    await expect(page.getByLabel(/National Insurance Number/)).toHaveCount(0);
    await expect(page.getByText('operator licence')).toBeVisible();
  });
});
