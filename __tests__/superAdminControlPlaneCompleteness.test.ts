import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const shell = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const governanceRoute = source('app/api/super-admin/governance/route.ts');
const brokerRoute = source('app/api/super-admin/brokers/route.ts');
const accessMatrix = source('app/super-admin/settings/roles-permissions/page.tsx');
const healthPage = source('app/super-admin/health/page.tsx');
const liveTable = source('app/super-admin/_components/SuperAdminLiveTablePage.tsx');
const ownerGuard = source('app/api/super-admin/_lib/verifyPlatformOwner.ts');
const commandCentre = source('app/api/super-admin/command-centre/route.ts');
const statsRoute = source('app/api/super-admin/stats/route.ts');
const onboardingRoute = source('app/api/super-admin/onboarding/route.ts');
const companyGovernanceRoute = source('app/api/super-admin/companies/[id]/route.ts');
const settingsRoute = source('app/api/super-admin/settings/route.ts');
const financeRoute = source('app/api/super-admin/finance/route.ts');
const superAdminAuthHeader = source('app/super-admin/_lib/getAuthHeader.ts');
const authContext = source('app/components/AuthContext.tsx');

const canonicalGuardRoutePaths = [
  'app/api/super-admin/audit/route.ts',
  'app/api/super-admin/brokers/route.ts',
  'app/api/super-admin/cases/route.ts',
  'app/api/super-admin/command-centre/route.ts',
  'app/api/super-admin/companies/[id]/route.ts',
  'app/api/super-admin/companies/approval-readiness/route.ts',
  'app/api/super-admin/companies/route.ts',
  'app/api/super-admin/companies/summary/route.ts',
  'app/api/super-admin/compliance/route.ts',
  'app/api/super-admin/email-readiness/route.ts',
  'app/api/super-admin/finance/route.ts',
  'app/api/super-admin/finance/summary/route.ts',
  'app/api/super-admin/governance/route.ts',
  'app/api/super-admin/health/route.ts',
  'app/api/super-admin/marketplace/[id]/route.ts',
  'app/api/super-admin/marketplace/route.ts',
  'app/api/super-admin/notifications/route.ts',
  'app/api/super-admin/onboarding/route.ts',
  'app/api/super-admin/operations/route.ts',
  'app/api/super-admin/platform/route.ts',
  'app/api/super-admin/settings/route.ts',
  'app/api/super-admin/stats/route.ts',
  'app/api/super-admin/support/route.ts',
  'app/api/super-admin/users/route.ts',
  'app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts',
  'app/api/super-admin/xdrive-logistics/enquiries/route.ts',
  'app/api/super-admin/xdrive-logistics/jobs/route.ts',
  'app/api/super-admin/xdrive-logistics/marketplace/route.ts',
] as const;

const canonicalGuardRoutes = canonicalGuardRoutePaths.map((path) => ({ path, content: source(path) }));

describe('Super Admin control-plane completeness', () => {
  it('keeps Platform Owner inside Super Admin instead of linking to the broker tenant workspace', () => {
    expect(shell).not.toContain("href: '/broker'");
    expect(shell).toContain("href: '/super-admin/companies/brokers'");
    expect(brokerRoute).toContain(".eq('company_type', 'broker')");
  });

  it('exposes the persistent owner-governance domains in navigation', () => {
    for (const href of [
      '/super-admin/fleet/vehicles',
      '/super-admin/fleet/return-journeys',
      '/super-admin/companies/memberships',
      '/super-admin/finance/subscriptions',
      '/super-admin/finance/stripe-webhooks',
      '/super-admin/settings/legal-agreements',
    ]) {
      expect(shell).toContain(`href: '${href}'`);
    }
  });

  it('keeps the Access Matrix semantically read-only', () => {
    expect(accessMatrix).toContain('Access Matrix');
    expect(accessMatrix).toContain('Read-only canonical workspace roles');
    expect(accessMatrix).toContain('Inspect');
    expect(accessMatrix).toContain('it does not mutate user authority');
    expect(accessMatrix).not.toContain('>Manage</button>');
  });

  it('covers vehicles, returns, memberships, subscriptions, Stripe webhooks and legal evidence in the owner API', () => {
    for (const section of ['vehicles', 'return-journeys', 'memberships', 'subscriptions', 'stripe-webhooks', 'legal-agreements']) {
      expect(governanceRoute).toContain(`section === '${section}'`);
    }
    expect(governanceRoute).toContain(".from('registration_legal_acceptances')");
    expect(governanceRoute).toContain(".from('platform_membership_subscriptions')");
    expect(governanceRoute).toContain(".from('stripe_webhook_events')");
  });

  it('makes shared live tables fail closed on timeout and invalid rows contracts', () => {
    expect(liveTable).toContain('REQUEST_TIMEOUT_MS');
    expect(liveTable).toContain('controller.abort()');
    expect(liveTable).toContain('if (!Array.isArray(fieldValue))');
    expect(liveTable).toContain('invalid data contract');
  });

  it('includes billing and webhook processing in Platform Health', () => {
    expect(healthPage).toContain('Membership Billing');
    expect(healthPage).toContain('Stripe Webhook Processing');
    expect(healthPage).toContain('setChecks([])');
    expect(healthPage).toContain('setIntegrations([])');
  });

  it('reuses the synchronized route-auth cookie for Super Admin API headers', () => {
    expect(superAdminAuthHeader).toContain('ROUTE_AUTH_COOKIE_NAME');
    expect(superAdminAuthHeader).toContain('document.cookie');
    expect(superAdminAuthHeader).toContain('decodeURIComponent');
    expect(superAdminAuthHeader).not.toContain('supabase.auth.getSession');
    expect(superAdminAuthHeader).not.toContain('supabaseClient');
  });

  it('defers Supabase API hydration outside the auth subscription callback', () => {
    expect(authContext).toContain('supabase.auth.onAuthStateChange((event, session) =>');
    expect(authContext).not.toContain('supabase.auth.onAuthStateChange(async');
    expect(authContext).toContain('window.setTimeout(() =>');
    expect(authContext).toContain('await hydrateUser(session.user)');
    expect(authContext).toContain('released before resolveAuthenticatedUser() issues database queries');
  });

  it('enforces active Platform Owner and Deploy Preview write lock in the canonical guard', () => {
    expect(ownerGuard).toContain(".select('role, status')");
    expect(ownerGuard).toContain("!== 'owner'");
    expect(ownerGuard).toContain("!== 'active'");
    expect(ownerGuard).toContain("const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])");
    expect(ownerGuard).toContain('isSuperAdminDeployPreviewReadOnly() && !READ_ONLY_METHODS.has');
    expect(ownerGuard).toContain('hasSuperAdminBearerAuthorization');
  });

  it('requires every remediated Super Admin API route to use the canonical owner guard', () => {
    for (const route of canonicalGuardRoutes) {
      expect(route.content, route.path).toContain('verifyPlatformOwner');
      expect(route.content, route.path).not.toContain('const resolveOwner = async');
      expect(route.content, route.path).not.toContain('getBearerToken');
    }
  });

  it('preserves 401 for missing Stats authentication and 403 for failed owner authorization', () => {
    expect(statsRoute).toContain('hasSuperAdminBearerAuthorization(request)');
    expect(statsRoute).toContain("respond(401, { error: 'Unauthorized: bearer token required.' })");
    expect(statsRoute).toContain("respond(403, { error: 'Forbidden: active Platform Owner required.' })");
  });

  it('keeps Command Centre exact-count and source-coverage semantics fail closed', () => {
    expect(commandCentre).toContain('result.error || result.count === null ? null : result.count');
    expect(commandCentre).toContain('Command Centre data could not be determined safely.');
    expect(commandCentre).toContain('Command Centre exact counts could not be determined safely.');
    expect(commandCentre).toContain('criticalCoverageUnavailable');
    expect(commandCentre).toContain('queueCoverageUnavailable');
    expect(commandCentre).toContain('amount, currency, due_date');
    expect(commandCentre).not.toContain(' · £');
  });

  it('paginates onboarding globally instead of presenting a capped page as platform truth', () => {
    expect(onboardingRoute).toContain("{ count: 'exact' }");
    expect(onboardingRoute).toContain('.range(offset, offset + limit - 1)');
    expect(onboardingRoute).toContain('total_active_applications');
    expect(onboardingRoute).not.toContain('.limit(250)');
  });

  it('keeps company governance audited, reconciled and preview-read-only', () => {
    expect(companyGovernanceRoute).toContain('verifyPlatformOwner');
    expect(companyGovernanceRoute).toContain('Deploy Preview is read-only. Company governance was not changed.');
    expect(companyGovernanceRoute).toContain(".rpc('set_company_status_governance'");
    expect(companyGovernanceRoute).toContain('Company governance action returned no reconciliation data.');
  });

  it('keeps role mutation gated while allowing only canonical feature/global settings writes', () => {
    expect(settingsRoute).toContain('mutable: false');
    expect(settingsRoute).toContain("code: 'role_mutation_gated'");
    expect(settingsRoute).toContain('Role mutation is intentionally disabled');
    expect(settingsRoute).not.toContain("section: z.literal('roles')");
  });

  it('keeps Finance paginated and rejects mixed-currency aggregate inference', () => {
    expect(financeRoute).toContain('const REPORT_PAGE_SIZE = 1000');
    expect(financeRoute).toContain('.range(offset, offset + REPORT_PAGE_SIZE - 1)');
    expect(financeRoute).toContain('.range(offset, offset + limit - 1)');
    expect(financeRoute).toContain('MULTI_CURRENCY_REVENUE_REQUIRES_BREAKDOWN');
    expect(financeRoute).toContain('MULTI_CURRENCY_SETTLEMENT_REQUIRES_BREAKDOWN');
  });
});
