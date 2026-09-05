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

  it('keeps the access matrix semantically read-only', () => {
    expect(accessMatrix).toContain('Access Matrix');
    expect(accessMatrix).toContain('read-only canonical workspace roles');
    expect(accessMatrix).toContain('Inspect');
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
    expect(liveTable).toContain("controller.abort()");
    expect(liveTable).toContain("if (!Array.isArray(fieldValue))");
    expect(liveTable).toContain('invalid data contract');
  });

  it('includes billing and webhook processing in Platform Health', () => {
    expect(healthPage).toContain('Membership Billing');
    expect(healthPage).toContain('Stripe Webhook Processing');
    expect(healthPage).toContain('setChecks([])');
    expect(healthPage).toContain('setIntegrations([])');
  });
});
