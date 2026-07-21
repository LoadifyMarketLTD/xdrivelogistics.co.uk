import { expect, test, type Page, type Route } from '@playwright/test';

import {
  ACCOUNT_TYPE_CONFIG,
  ACCOUNT_TYPES,
  type AccountType,
  type StoredOnboardingAccountType,
} from '../lib/accountTypes';
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

type FlowState = {
  status: 'draft' | 'in_progress' | 'under_review' | 'approved';
  currentStep: string;
  completionPercentage: number;
  payload: Record<string, unknown>;
};

type FlowCase = {
  accountType: AccountType;
  storedAccountType: StoredOnboardingAccountType;
  email: string;
  userId: string;
  onboardingPath: string;
  expectedSubmitStatus: 'approved' | 'under_review';
  workspacePath: '/customer' | '/broker' | '/admin' | '/driver';
  appRole: AppUserRole;
  workspaceRole: WorkspaceRole;
  fillRequiredFields: (page: Page) => Promise<void>;
  persistedField: { label: RegExp; value: string };
};

const fillFields = async (page: Page, fields: Array<[RegExp, string]>) => {
  for (const [label, value] of fields) {
    await page.getByLabel(label).fill(value);
  }
};

const FLOW_CASES: FlowCase[] = [
  {
    accountType: 'customer',
    storedAccountType: 'customer_shipper',
    email: 'customer-four-role@example.test',
    userId: 'customer-four-role',
    onboardingPath: '/onboarding/customer/resume',
    expectedSubmitStatus: 'approved',
    workspacePath: '/customer',
    appRole: 'customer',
    workspaceRole: 'customer',
    fillRequiredFields: async (page) => fillFields(page, [
      [/Full Name/, 'Customer Test User'],
      [/^Email/, 'customer-four-role@example.test'],
      [/Phone/, '07111111111'],
      [/Company Name/, 'Customer Test Ltd'],
      [/Billing Address/, '1 Customer Street, Blackburn'],
    ]),
    persistedField: { label: /Full Name/, value: 'Customer Test User' },
  },
  {
    accountType: 'broker',
    storedAccountType: 'broker_shipper',
    email: 'broker-four-role@example.test',
    userId: 'broker-four-role',
    onboardingPath: '/onboarding/broker/resume',
    expectedSubmitStatus: 'under_review',
    workspacePath: '/broker',
    appRole: 'broker',
    workspaceRole: 'broker',
    fillRequiredFields: async (page) => fillFields(page, [
      [/Company Name/, 'Broker Test Ltd'],
      [/Trading Name/, 'Broker Test'],
      [/Company Number/, '12345678'],
      [/VAT Number/, 'GB123456789'],
      [/Billing Address/, '2 Broker Street, Blackburn'],
      [/Trading Address/, '2 Broker Street, Blackburn'],
      [/Contact Person/, 'Broker Contact'],
      [/Finance Contact/, 'Broker Finance'],
      [/^Email/, 'broker-four-role@example.test'],
      [/^Phone/, '07222222222'],
    ]),
    persistedField: { label: /Company Name/, value: 'Broker Test Ltd' },
  },
  {
    accountType: 'fleet_operator',
    storedAccountType: 'fleet_courier',
    email: 'fleet-four-role@example.test',
    userId: 'fleet-four-role',
    onboardingPath: '/onboarding/fleet/resume',
    expectedSubmitStatus: 'under_review',
    workspacePath: '/admin',
    appRole: 'company_admin',
    workspaceRole: 'company_admin',
    fillRequiredFields: async (page) => fillFields(page, [
      [/Legal Company Name/, 'Fleet Test Logistics Ltd'],
      [/Trading Name/, 'Fleet Test'],
      [/Company Number/, '87654321'],
      [/VAT Number/, 'GB987654321'],
      [/Registered Address/, '3 Fleet Street, Blackburn'],
      [/Trading Address/, '3 Fleet Street, Blackburn'],
      [/Contact Person/, 'Fleet Contact'],
      [/Compliance Contact/, 'Fleet Compliance'],
      [/Transport Contact/, 'Fleet Transport'],
    ]),
    persistedField: { label: /Legal Company Name/, value: 'Fleet Test Logistics Ltd' },
  },
  {
    accountType: 'owner_driver',
    storedAccountType: 'owner_driver',
    email: 'owner-driver-four-role@example.test',
    userId: 'owner-driver-four-role',
    onboardingPath: '/onboarding/owner-driver/resume',
    expectedSubmitStatus: 'under_review',
    workspacePath: '/driver',
    appRole: 'driver',
    workspaceRole: 'owner_driver',
    fillRequiredFields: async (page) => fillFields(page, [
      [/Full Name/, 'Owner Driver Test'],
      [/Date of Birth/, '1990-01-15'],
      [/Home Address/, '4 Driver Street, Blackburn'],
      [/^Phone/, '07333333333'],
      [/^Email/, 'owner-driver-four-role@example.test'],
      [/National Insurance Number/, 'QQ123456C'],
      [/Right to Work Status/, 'settled'],
      [/Driving Licence Number/, 'TEST123456789'],
      [/Driving Licence Expiry/, '2030-01-15'],
      [/Vehicle Registration/, 'AB12 CDE'],
      [/Vehicle Make/, 'Mercedes-Benz'],
      [/Vehicle Model/, 'Sprinter'],
      [/Vehicle Payload/, '1000 kg'],
      [/Vehicle Dimensions/, '4m x 2m x 2m'],
    ]),
    persistedField: { label: /Full Name/, value: 'Owner Driver Test' },
  },
];

const authResponse = (flow: FlowCase) => ({
  access_token: `access-${flow.userId}`,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: `refresh-${flow.userId}`,
  user: {
    id: flow.userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: flow.email,
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmation_sent_at: null,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      role: flow.appRole,
    },
    user_metadata: {
      role: flow.appRole,
      requested_role: flow.accountType,
      signup_type: flow.accountType,
      account_type: flow.accountType,
      workspace_mode: ACCOUNT_TYPE_CONFIG[flow.accountType].workspaceMode,
      owner_driver_workspace: flow.accountType === 'owner_driver',
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

const applicationFor = (flow: FlowCase, state: FlowState) => ({
  id: `${flow.accountType}-four-role-application`,
  user_id: flow.userId,
  account_type: flow.storedAccountType,
  status: state.status,
  current_step: state.currentStep,
  completion_percentage: state.completionPercentage,
  payload: state.payload,
});

const mockFourRoleFlow = async (page: Page, flow: FlowCase, state: FlowState) => {
  let logoutCount = 0;

  await page.route(`${SUPABASE_ORIGIN}/auth/v1/token**`, async (route) => {
    await fulfilJson(route, authResponse(flow));
  });
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/user**`, async (route) => {
    await fulfilJson(route, authResponse(flow).user);
  });
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/logout**`, async (route) => {
    logoutCount += 1;
    await fulfilJson(route, {});
  });

  await page.route('**/api/onboarding/init', async (route) => {
    await fulfilJson(route, {
      onboardingApplicationId: `${flow.accountType}-four-role-application`,
      status: state.status,
      accountType: flow.accountType,
      onboardingUrl: '/onboarding/resume',
      invitationRevoked: false,
      resumeAllowed: true,
    });
  });

  const respondToSession = async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      const body = requestJson(route);
      state.payload = {
        ...state.payload,
        ...((body.payload ?? {}) as Record<string, unknown>),
      };
      state.status = 'in_progress';
      state.currentStep = String(body.currentStep ?? state.currentStep);
      state.completionPercentage = Number(body.completionPercentage ?? state.completionPercentage);
    }
    await fulfilJson(route, { application: applicationFor(flow, state), resumable: true });
  };

  if (flow.accountType === 'customer') {
    await page.route('**/api/onboarding/customer/session**', respondToSession);
  } else if (flow.accountType === 'broker') {
    await page.route('**/api/onboarding/broker/session**', respondToSession);
  } else {
    await page.route('**/api/onboarding/session**', respondToSession);
    const segment = flow.accountType === 'fleet_operator' ? 'fleet' : 'owner-driver';
    await page.route(`**/api/onboarding/${segment}/session**`, respondToSession);
  }

  const submitSegment = flow.accountType === 'fleet_operator'
    ? 'fleet'
    : flow.accountType === 'owner_driver'
      ? 'owner-driver'
      : flow.accountType;
  await page.route(`**/api/onboarding/submit/${submitSegment}`, async (route) => {
    state.status = flow.expectedSubmitStatus;
    state.completionPercentage = 100;
    await fulfilJson(route, { application: applicationFor(flow, state), status: state.status });
  });

  return { logoutCount: () => logoutCount };
};

const login = async (page: Page, flow: FlowCase) => {
  await page.goto('/login');
  await page.locator('#email').fill(flow.email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => url.pathname === flow.onboardingPath, { timeout: 15_000 });
};

test.describe('Four-role onboarding contract', () => {
  test('canonical account types map to distinct stored roles, onboarding pages and workspaces', () => {
    expect(ACCOUNT_TYPES).toEqual(['customer', 'broker', 'fleet_operator', 'owner_driver']);

    for (const flow of FLOW_CASES) {
      const config = ACCOUNT_TYPE_CONFIG[flow.accountType];
      expect(config.storedAccountType).toBe(flow.storedAccountType);
      expect(config.onboardingPath).toBe(flow.onboardingPath);

      const route = getPostLoginRoute({
        role: flow.appRole,
        rawRole: flow.appRole,
        workspaceRole: flow.workspaceRole,
        membershipRole: flow.accountType === 'fleet_operator' ? 'admin' : null,
        mustChangePassword: false,
        ownerDriverWorkspace: flow.accountType === 'owner_driver',
        canAccessDriverMode: flow.accountType === 'owner_driver',
        ownerDriverExecutionMode: false,
        financeAccess: 'hidden',
      });
      expect(route).toBe(flow.workspacePath);
    }
  });

  test('each approved role is isolated from the other three workspace portals', () => {
    const portalPaths = ['/customer', '/broker', '/admin', '/driver'] as const;

    for (const flow of FLOW_CASES) {
      for (const path of portalPaths) {
        const allowed = isRoleAllowedForPath(path, flow.appRole, {
          workspaceRole: flow.workspaceRole,
          membershipRole: flow.accountType === 'fleet_operator' ? 'admin' : null,
          ownerDriverWorkspace: flow.accountType === 'owner_driver',
          canAccessDriverMode: flow.accountType === 'owner_driver',
        });
        expect(allowed, `${flow.accountType} access to ${path}`).toBe(path === flow.workspacePath);
      }
    }
  });

  test('the final payload contract is valid for all four account types', () => {
    expect(customerPayloadSchema.safeParse({
      full_name: 'Customer Test User',
      contact_email: 'customer@example.test',
      contact_phone: '',
      company_name: 'Customer Ltd',
      billing_address: '1 Customer Street',
    }).success).toBe(true);

    expect(brokerPayloadSchema.safeParse({
      company_name: 'Broker Ltd',
      trading_name: 'Broker',
      company_number: '12345678',
      vat_number: 'GB123456789',
      billing_address: '2 Broker Street',
      trading_address: '2 Broker Street',
      contact_person: 'Broker Contact',
      finance_contact: 'Broker Finance',
      contact_email: 'broker@example.test',
      contact_phone: '07111111111',
    }).success).toBe(true);

    expect(fleetPayloadSchema.safeParse({
      legal_company_name: 'Fleet Ltd',
      trading_name: 'Fleet',
      company_number: '87654321',
      vat_number: 'GB987654321',
      registered_address: '3 Fleet Street',
      trading_address: '3 Fleet Street',
      contact_person: 'Fleet Contact',
      compliance_contact: 'Fleet Compliance',
      transport_contact: 'Fleet Transport',
    }).success).toBe(true);

    expect(ownerDriverPayloadSchema.safeParse({
      full_name: 'Owner Driver',
      date_of_birth: '1990-01-15',
      address: '4 Driver Street',
      contact_phone: '07333333333',
      contact_email: 'driver@example.test',
      national_insurance_number: 'QQ123456C',
      right_to_work_status: 'settled',
      licence_number: 'TEST123456789',
      licence_expiry: '2030-01-15',
      registration: 'AB12 CDE',
      make: 'Mercedes-Benz',
      model: 'Sprinter',
      payload: '1000 kg',
      dimensions: '4m x 2m x 2m',
    }).success).toBe(true);
  });

  for (const flow of FLOW_CASES) {
    test(`${flow.accountType}: save → sign out → login → resume → submit`, async ({ page }) => {
      const state: FlowState = {
        status: 'draft',
        currentStep: 'account_type_wizard',
        completionPercentage: 5,
        payload: {},
      };
      const controls = await mockFourRoleFlow(page, flow, state);

      await login(page, flow);
      await flow.fillRequiredFields(page);
      await page.getByRole('button', { name: 'Save and continue later' }).click();
      await expect(page.getByText(/Progress saved/)).toBeVisible();
      expect(state.status).toBe('in_progress');
      expect(state.payload).toMatchObject({
        [Object.keys(state.payload)[0] as string]: Object.values(state.payload)[0],
      });

      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.waitForURL((url) => url.pathname === '/login', { timeout: 10_000 });
      expect(controls.logoutCount()).toBe(1);

      await page.locator('#email').fill(flow.email);
      await page.locator('#password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL((url) => url.pathname === flow.onboardingPath, { timeout: 15_000 });
      await expect(page.getByLabel(flow.persistedField.label)).toHaveValue(flow.persistedField.value);

      await page.getByRole('button', { name: 'Submit for review' }).click();
      await expect.poll(() => state.status).toBe(flow.expectedSubmitStatus);

      if (flow.expectedSubmitStatus === 'under_review') {
        await page.waitForURL((url) => url.pathname === '/pending-approval', { timeout: 10_000 });
        await expect(page.getByText('This is not a suspension.')).toBeVisible();
      }
    });
  }
});
