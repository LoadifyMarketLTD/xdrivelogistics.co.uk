import { expect, test } from '@playwright/test';
import { mockWorkspace, roots } from './helpers/workspaceRecoveryFixtures';

test.use({ serviceWorkers: 'block' });
test.describe('Legal contractual context prerequisite', () => {
  test.skip(process.env.E2E_VISUAL_FIXTURE !== 'true', 'Local isolated fixture required.');
  for (const role of ['carrier', 'customer', 'broker', 'owner', 'driver'] as const) {
    test(`${role}: a missing contractual role opens setup, never accepts a guessed agreement`, async ({ page }, info) => {
      await mockWorkspace(page, role);
      const writes: string[] = [];
      page.on('request', (request) => { if (request.url().includes('/api/account/legal-agreements') && request.method() !== 'GET') writes.push(request.method()); });
      await page.route('**/api/account/legal-agreements?**', (route) => route.fulfill({ status: 409, json: { code: 'legal_contractual_role_unavailable', error: 'No supported contractual role is available for this account.' } }));
      await page.goto(`/visual-fixture/workspace-recovery/${role}?screen=legal-recovery`);
      await expect(page.getByRole('heading', { name: 'Account setup required before legal review' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Complete / recover account setup' })).toHaveAttribute('href', '/onboarding/resume');
      await expect(page.getByRole('link', { name: 'Get workspace support' })).toHaveAttribute('href', `${roots[role]}/support?reason=legal-contractual-role`);
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByText('Legal history unavailable', { exact: true })).toHaveCount(0);
      expect(writes).toEqual([]);
      await page.screenshot({ path: info.outputPath(`${role}-legal-setup.png`), fullPage: true });
    });
  }
  test('a service failure is not incorrectly presented as missing onboarding', async ({ page }) => {
    await mockWorkspace(page, 'carrier');
    await page.route('**/api/account/legal-agreements?**', (route) => route.fulfill({ status: 503, json: { error: 'Fixture legal service temporarily unavailable' } }));
    await page.goto('/visual-fixture/workspace-recovery/carrier?screen=legal-recovery');
    await expect(page.getByText('Fixture legal service temporarily unavailable')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Complete / recover account setup' })).toHaveCount(0);
  });
});
