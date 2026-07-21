import { expect, test, type Page, type Route } from '@playwright/test';

import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPES,
  type AccountType,
} from '../lib/accountTypes';
import {
  classifyAccessLifecycleStatus,
  classifyOnboardingLifecycleStatus,
} from '../lib/accessLifecycle';
import {
  brokerPayloadSchema,
  customerPayloadSchema,
  fleetPayloadSchema,
  ownerDriverPayloadSchema,
} from '../app/api/onboarding/_lib/schemas';
import { getPostLoginRoute } from '../lib/authSession';
import { isRoleAllowedForPath, type AppUserRole } from '../lib/authRole';
import type { WorkspaceRole } from '../lib/workspaceRole';

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

type RoleCase = {
  accountType: AccountType;
  appRole: AppUserRole;
  workspaceRole: WorkspaceRole;
  workspacePath: '/customer' | '/broker' | '/admin' | '/driver';
};

const ROLE_CASES: RoleCase[] = [
  { accountType: 'customer', appRole: 'customer', workspaceRole: 'customer', workspacePath: '/customer' },
  { accountType: 'broker', appRole: 'broker', workspaceRole: 'broker', workspacePath: '/broker' },
  { accountType: 'fleet_operator', appRole: 'company_admin', workspaceRole: 'company_owner', workspacePath: '/admin' },
  { accountType: 'owner_driver', appRole: 'driver', workspaceRole: 'owner_driver', workspacePath: '/driver' },
];

const authResponse = (roleCase: RoleCase, email?: string) => {
  const config = ACCOUNT_TYPE_CONFIG[roleCase.accountType];
  const userId = `contract-${roleCase.accountType}`;
  const userEmail = email ?? `${roleCase.accountType}@contract.example.test`;
  const metadata = {
    role: config.appRole,
    requested_role: roleCase.accountType,
    signup_type: roleCase.accountType,
    account_type: roleCase.accountType,
    workspace_mode: config.workspaceMode,
    owner_driver_workspace: config.ownerDriverWorkspace,
  };

  return {
    access_token: `access-${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${userId}`,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: userEmail,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmation_sent_at: null,
      app_metadata: { provider: 'email', providers: ['email'], role: config.appRole },
      user_metadata: metadata,
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
};

const applicationFor = (roleCase: RoleCase, status = 'draft') => ({
  id: `application-${roleCase.accountType}`,
  user_id: `contract-${roleCase.accountType}`,
  account_type: ACCOUNT_TYPE_CONFIG[roleCase.accountType].storedAccountType,
  status,
  current_step: 'account_type_confirmed',
  completion_percentage: status === 'under_review' ? 100 : 5,
  payload: {},
});

const mockOnboarding = async (
  page: Page,
  roleCase: RoleCase,
  status: 'draft' | 'in_progress' | 'under_review' = 'draft',
  onInit?: (payload: Record<string, unknown>) => void,
) => {
  const application = applicationFor(roleCase, status);

  await page.route('**/api/onboarding/init', async (route) => {
    if (route.request().method() === 'POST') onInit?.(requestJson(route));
    await fulfilJson(route, {
      onboardingApplicationId: application.id,
      status,
      accountType: roleCase.accountType,
      onboardingPath: '/onboarding/resume',
      resumeAllowed: true,
    });
  });

  await page.route('**/api/onboarding/session**', async (route) => {
    await fulfilJson(route, { application, resumable: true, resumePath: '/onboarding/resume' });
  });
};

const fillLogin = async (page: Page, email: string, password: string) => {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
};

test.describe('Canonical registration and onboarding contract', () => {
  test('the four public account types have distinct stored identities and workspaces', () => {
    expect(ACCOUNT_TYPES).toEqual(['customer', 'broker', 'fleet_operator', 'owner_driver']);

    for (const roleCase of ROLE_CASES) {
      const config = ACCOUNT_TYPE_CONFIG[roleCase.accountType];
      expect(config.appRole).toBe(roleCase.appRole);
      expect(config.onboardingPath).toBe('/onboarding/resume');

      const route = getPostLoginRoute({
        role: roleCase.appRole,
        rawRole: roleCase.accountType,
        workspaceRole: roleCase.workspaceRole,
        membershipRole: roleCase.accountType === 'fleet_operator' ? 'owner' : null,
        mustChangePassword: false,
        ownerDriverWorkspace: roleCase.accountType === 'owner_driver',
        canAccessDriverMode: roleCase.accountType === 'owner_driver',
        ownerDriverExecutionMode: false,
        financeAccess: roleCase.accountType === 'owner_driver' ? 'hidden' : 'full',
      });
      expect(route).toBe(roleCase.workspacePath);
    }
  });

  test('each approved public role is isolated from the other three portals', () => {
    const portals = ['/customer', '/broker', '/admin', '/driver'] as const;

    for (const roleCase of ROLE_CASES) {
      for (const path of portals) {
        const allowed = isRoleAllowedForPath(path, roleCase.appRole, {
          rawRole: roleCase.accountType,
          workspaceRole: roleCase.workspaceRole,
          membershipRole: roleCase.accountType === 'fleet_operator' ? 'owner' : null,
          ownerDriverWorkspace: roleCase.accountType === 'owner_driver',
          canAccessDriverMode: roleCase.accountType === 'owner_driver',
        });
        expect(allowed, `${roleCase.accountType} access to ${path}`).toBe(path === roleCase.workspacePath);
      }
    }
  });

  test('pending and review lifecycle values can never be classified as suspension', () => {
    for (const status of ['pending', 'pending_approval', 'draft', 'in_progress', 'submitted', 'under_review', 'compliance_review', 'admin_approval']) {
      expect(classifyAccessLifecycleStatus(status), status).toBe('pending');
    }
    for (const status of ['blocked', 'suspended', 'inactive', 'disabled', 'rejected']) {
      expect(classifyAccessLifecycleStatus(status), status).toBe('blocked');
    }

    expect(classifyOnboardingLifecycleStatus('draft')).toBe('editable');
    expect(classifyOnboardingLifecycleStatus('request_changes')).toBe('editable');
    expect(classifyOnboardingLifecycleStatus('under_review')).toBe('review');
    expect(classifyOnboardingLifecycleStatus('approved')).toBe('approved');
    expect(classifyOnboardingLifecycleStatus('rejected')).toBe('rejected');
  });

  test('all final payload schemas accept the canonical field names', () => {
    expect(customerPayloadSchema.safeParse({
      full_name: 'Customer User',
      contact_email: 'customer@example.test',
      contact_phone: '',
      company_name: '',
      billing_address: '',
    }).success).toBe(true);

    expect(brokerPayloadSchema.safeParse({
      company_name: 'Broker Ltd', trading_name: 'Broker', company_number: '12345678',
      vat_number: 'GB123456789', billing_address: '1 Broker Street', trading_address: '1 Broker Street',
      contact_person: 'Broker Contact', finance_contact: 'Finance Contact',
      contact_email: 'broker@example.test', contact_phone: '07111111111',
    }).success).toBe(true);

    expect(fleetPayloadSchema.safeParse({
      legal_company_name: 'Fleet Ltd', trading_name: 'Fleet', company_number: '87654321',
      vat_number: 'GB987654321', registered_address: '2 Fleet Street', trading_address: '2 Fleet Street',
      contact_person: 'Fleet Contact', compliance_contact: 'Compliance Contact', transport_contact: 'Transport Contact',
    }).success).toBe(true);

    const ownerDriver = {
      full_name: 'Owner Driver', date_of_birth: '1990-01-15', address: '3 Driver Street',
      contact_phone: '07222222222', contact_email: 'driver@example.test', national_insurance_number: 'QQ123456C',
      right_to_work_status: 'settled', licence_number: 'TEST123456789', licence_expiry: '2030-01-15',
      registration: 'AB12 CDE', make: 'Mercedes-Benz', model: 'Sprinter', payload: '1000 kg', dimensions: '4m x 2m x 2m',
    };
    expect(ownerDriverPayloadSchema.safeParse(ownerDriver).success).toBe(true);
    expect(ownerDriverPayloadSchema.safeParse({ ...ownerDriver, date_of_birth: undefined, dob: '1990-01-15' }).success).toBe(false);
  });

  for (const roleCase of ROLE_CASES) {
    test(`${roleCase.accountType} signup sends the canonical network payload`, async ({ page }) => {
      const config = ACCOUNT_TYPE_CONFIG[roleCase.accountType];
      const email = `${roleCase.accountType}@signup.example.test`;
      const capturedInit: Record<string, unknown>[] = [];
      let capturedMetadata: Record<string, unknown> | null = null;

      await mockOnboarding(page, roleCase, 'draft', (payload) => capturedInit.push(payload));
      await page.route(`${SUPABASE_ORIGIN}/auth/v1/signup**`, async (route) => {
        const body = requestJson(route);
        capturedMetadata = (body.data ?? {}) as Record<string, unknown>;
        await fulfilJson(route, authResponse(roleCase, email));
      });

      await page.goto('/register');
      await page.locator('#register-email').fill(email);
      await page.locator('#register-role').selectOption(roleCase.accountType);
      await page.locator('#register-password').fill(PASSWORD);
      await page.locator('#register-password-confirm').fill(PASSWORD);
      await page.getByRole('button', { name: 'Create account and continue' }).click();

      await page.waitForURL((url) => url.pathname === '/onboarding/resume', { timeout: 15_000 });
      expect(capturedMetadata).toMatchObject({
        role: config.appRole,
        requested_role: roleCase.accountType,
        signup_type: roleCase.accountType,
        account_type: roleCase.accountType,
        workspace_mode: config.workspaceMode,
        owner_driver_workspace: config.ownerDriverWorkspace,
      });
      expect(capturedInit).toContainEqual({
        account_type: roleCase.accountType,
        forceRegenerateToken: false,
      });
    });
  }

  test('two invalid passwords followed by a correct Broker login never show suspension', async ({ page }) => {
    const roleCase = ROLE_CASES.find((item) => item.accountType === 'broker')!;
    const email = 'broker-under-review@example.test';
    let attempts = 0;

    await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
      attempts += 1;
      if (attempts <= 2) {
        await fulfilJson(route, { code: 'invalid_credentials', message: 'Invalid login credentials' }, 400);
        return;
      }
      await fulfilJson(route, authResponse(roleCase, email));
    });
    await page.route(`${SUPABASE_ORIGIN}/auth/v1/user**`, async (route) => {
      await fulfilJson(route, authResponse(roleCase, email).user);
    });
    await mockOnboarding(page, roleCase, 'under_review');

    await page.goto('/login');
    await fillLogin(page, email, 'WrongPasswordOne!');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page.getByText(/suspended/i)).toHaveCount(0);

    await fillLogin(page, email, 'WrongPasswordTwo!');
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page.getByText(/suspended/i)).toHaveCount(0);

    await fillLogin(page, email, PASSWORD);
    await page.waitForURL((url) => url.pathname === '/pending-approval', { timeout: 15_000 });
    await expect(page.getByText(/suspended/i)).toHaveCount(0);
    expect(attempts).toBe(3);
  });
});
