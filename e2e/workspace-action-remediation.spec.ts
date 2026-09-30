import { expect, test } from '@playwright/test';
import { COMPANY, USER, roots, mockWorkspace } from './helpers/workspaceRecoveryFixtures';
test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });

test.describe('readiness: actionable restrictions with isolated services', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Requires local-only fixtures.');
  function restrictions(role: 'carrier' | 'customer' | 'broker' | 'owner' | 'driver') {
    const root = roots[role];
    const segment = role === 'carrier' ? 'fleet' : role === 'owner' ? 'owner-driver' : role === 'driver' ? 'individual-driver' : role;
    const legal = root + (role === 'carrier' ? '/settings/legal-agreements' : '/account/legal-agreements');
    return [
      { code: 'STRIPE_COMMERCIAL_READINESS_REQUIRED', title: 'Company Stripe setup is incomplete', message: role === 'driver' ? 'Your company administrator must activate Stripe. You do not need a personal Stripe account.' : 'Complete and activate your company Stripe account.', operation: 'commercial',
        actionType: role === 'driver' ? 'link' : 'stripe_setup', actionLabel: 'Get company setup help', companyId: COMPANY, actionHref: root + '/support?reason=stripe-company-setup' },
      { code: 'DOCUMENT_REQUIRED_identity_driving_licence', title: 'Document requires attention: driving licence', message: 'This evidence is missing, unapproved or expired.', operation: 'commercial', actionType: 'link', actionLabel: 'Review / upload driving licence', actionHref: '/onboarding/' + segment + '/resume?document=driving_licence#onboarding-document-driving_licence' },
      { code: 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED', title: 'Legal agreements must be accepted', message: 'Review the current agreements.', operation: 'commercial', actionType: 'link', actionLabel: 'Review & accept agreements', actionHref: legal },
    ];
  }
  for (const role of ['carrier', 'customer', 'broker', 'owner'] as const) {
    for (const width of [1440, 390]) {
      test(role + ': recovery buttons visible and usable at ' + width, async ({ page }, info) => {
        await mockWorkspace(page, role);
        await page.route('**/api/workspace/readiness**', (route) => route.fulfill({ json: { ready: false, companyId: COMPANY, blockers: restrictions(role) } }));
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/visual-fixture/workspace-recovery/' + role + '?screen=readiness');
        const region = page.getByRole('region', { name: 'Workspace restrictions' });
        await expect(region.getByRole('button', { name: 'Set up / activate Stripe' })).toBeVisible();
        const doc = region.getByRole('link', { name: 'Review / upload driving licence' });
        await expect(doc).toHaveAttribute('target', '_blank');
        await expect(doc).toHaveAttribute('href', /document=driving_licence#onboarding-document-driving_licence$/);
        await expect(region.getByRole('link', { name: 'Review & accept agreements' })).toHaveAttribute('href', restrictions(role)[2].actionHref!);
        expect(await region.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
        await page.screenshot({ path: info.outputPath(role + '-readiness-' + width + '.png'), fullPage: true });
      });
    }
  }
  test('company driver receives a delegated action, not personal Stripe setup', async ({ page }) => {
    await mockWorkspace(page, 'driver');
    await page.route('**/api/workspace/readiness**', (route) => route.fulfill({ json: { ready: false, blockers: [restrictions('driver')[0]] } }));
    await page.goto('/visual-fixture/workspace-recovery/driver?screen=readiness');
    await expect(page.getByText('You do not need a personal Stripe account.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set up / activate Stripe' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Get company setup help' })).toHaveAttribute('href', '/driver/support?reason=stripe-company-setup');
  });
  test('failed readiness request remains visible and can be retried', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    let failed = true;
    await page.route('**/api/workspace/readiness**', (route) => route.fulfill({ status: failed ? 503 : 200, json: failed ? { ready: false, error: 'Fixture readiness unavailable' } : { ready: true, blockers: [] } }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=readiness');
    await expect(page.getByRole('alert').filter({ hasText: 'Fixture readiness unavailable' })).toBeVisible();
    failed = false;
    await page.getByRole('button', { name: 'Re-check requirements' }).click();
    await expect(page.getByRole('region', { name: 'Workspace restrictions' })).toHaveCount(0);
  });
  test('returning from recovery rechecks without clearing or submitting a load form', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    let ready = false; let writes = 0;
    await page.route('**/api/jobs/create', (route) => { writes++; return route.fulfill({ status: 500, json: { error: 'Must not auto-submit' } }); });
    await page.route('**/api/workspace/readiness**', (route) => route.fulfill({ json: { ready, blockers: ready ? [] : restrictions('carrier') } }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=post-load');
    await expect(page.getByRole('button', { name: 'Set up / activate Stripe' })).toBeVisible();
    await page.locator('textarea').first().fill('Collection address must be preserved');
    ready = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('region', { name: 'Workspace restrictions' })).toHaveCount(0);
    await expect(page.locator('textarea').first()).toHaveValue('Collection address must be preserved');
    expect(writes).toBe(0);
  });
  test('an uploaded document can be targeted directly for renewal on the real onboarding page', async ({ page }, info) => {
    await mockWorkspace(page, 'owner');
    await page.route('**/api/onboarding/session**', (route) => route.fulfill({ json: { application: {
      id: 'application-fixture', user_id: USER, account_type: 'owner_driver', status: 'approved',
      current_step: 'complete', completion_percentage: 100, company_id: COMPANY,
      payload: { full_name: 'Fixture Driver', doc_driving_licence: 'already-uploaded.pdf' },
    } } }));
    await page.goto('/onboarding/owner-driver/resume?document=driving_licence#onboarding-document-driving_licence');
    const input = page.locator('#onboarding-file-driving_licence');
    await expect(input).toBeVisible({ timeout: 20000 });
    await expect(input).toBeFocused();
    await expect(page.locator('#onboarding-document-driving_licence')).toHaveAttribute('data-recovery-document', 'true');
    await page.screenshot({ path: info.outputPath('targeted-onboarding-document.png'), fullPage: true });
  });
});
