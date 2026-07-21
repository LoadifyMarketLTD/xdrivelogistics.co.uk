import { expect, test, type Page, type Route } from '@playwright/test';

import { ACCOUNT_TYPE_CONFIG, ACCOUNT_TYPES, type AccountType } from '../lib/accountTypes';

const SUPABASE_ORIGIN = 'https://placeholder.supabase.co';

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

const authResponse = (accountType: AccountType) => {
  const config = ACCOUNT_TYPE_CONFIG[accountType];
  const userId = `confirmed-${accountType}`;
  const email = `${accountType}@confirmation.example.test`;
  const userMetadata = {
    role: config.appRole,
    requested_role: accountType,
    signup_type: accountType,
    account_type: accountType,
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
      email,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmation_sent_at: null,
      app_metadata: { provider: 'email', providers: ['email'], role: config.appRole },
      user_metadata: userMetadata,
      identities: [{ id: `identity-${userId}`, provider: 'email' }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
};

const mockOnboardingPage = async (page: Page, accountType: AccountType) => {
  const config = ACCOUNT_TYPE_CONFIG[accountType];
  const application = {
    id: `confirmed-${accountType}-application`,
    user_id: `confirmed-${accountType}`,
    account_type: config.storedAccountType,
    status: 'draft',
    current_step: 'account_type_wizard',
    completion_percentage: 5,
    payload: {},
  };

  if (accountType === 'customer') {
    await page.route('**/api/onboarding/customer/session**', async (route) => {
      await fulfilJson(route, { application, resumable: true });
    });
  } else if (accountType === 'broker') {
    await page.route('**/api/onboarding/broker/session**', async (route) => {
      await fulfilJson(route, { application, resumable: true });
    });
  } else {
    await page.route('**/api/onboarding/session**', async (route) => {
      await fulfilJson(route, { application, resumable: true });
    });
  }
};

test.describe('Email confirmation callback', () => {
  for (const accountType of ACCOUNT_TYPES) {
    test(`${accountType} confirmation initializes and opens the correct onboarding`, async ({ page }) => {
      const auth = authResponse(accountType);
      const initPayloads: Record<string, unknown>[] = [];

      await page.route(`${SUPABASE_ORIGIN}/auth/v1/verify**`, async (route) => {
        await fulfilJson(route, auth);
      });
      await page.route(`${SUPABASE_ORIGIN}/auth/v1/user**`, async (route) => {
        await fulfilJson(route, auth.user);
      });
      await page.route('**/api/onboarding/init', async (route) => {
        initPayloads.push(requestJson(route));
        await fulfilJson(route, {
          onboardingApplicationId: `confirmed-${accountType}-application`,
          status: 'draft',
          accountType,
          onboardingUrl: '/onboarding/resume',
          invitationRevoked: false,
          resumeAllowed: true,
        });
      });
      await mockOnboardingPage(page, accountType);

      await page.goto(`/auth/callback?token_hash=confirmation-${accountType}&type=signup`);
      await page.waitForURL((url) => url.pathname === ACCOUNT_TYPE_CONFIG[accountType].onboardingPath, { timeout: 15_000 });

      await expect(page.getByRole('heading', {
        name: accountType === 'customer'
          ? 'Customer / Shipper Onboarding'
          : accountType === 'broker'
            ? 'Broker / Shipper Onboarding'
            : accountType === 'fleet_operator'
              ? 'Fleet Operator Onboarding'
              : 'Owner Driver Onboarding',
      })).toBeVisible();

      expect(initPayloads).toContainEqual({ forceRegenerateToken: false });
    });
  }
});
