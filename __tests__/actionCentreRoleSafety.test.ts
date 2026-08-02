import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTION_CENTRE_ROLE_PREFIX,
  getActionCentreRoute,
  isActionCentreEventVisibleToRole,
  resolveRoleScopedHref,
  resolveActionCentreRole,
} from '../app/components/workspace/actionCentreConfig';
import { isActionCentreRoleAllowed } from '../app/components/workspace/actionCentreAuthorisation';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Action Centre shared-module adoption', () => {
  it('uses the shared ActionCentrePage module for all thin routes', () => {
    ['app/admin/action-centre/page.tsx', 'app/broker/action-centre/page.tsx', 'app/customer/action-centre/page.tsx', 'app/driver/action-centre/page.tsx']
      .forEach((filePath) => {
        const source = read(filePath);
        expect(source).toContain("import ActionCentrePage from '../../components/workspace/ActionCentrePage';");
        expect(source).not.toContain('AdminWorkspaceModules');
      });
  });

  it('maps workspace roles to role-scoped action-centre audiences', () => {
    expect(resolveActionCentreRole('company_admin')).toBe('admin');
    expect(resolveActionCentreRole('broker')).toBe('broker');
    expect(resolveActionCentreRole('customer')).toBe('customer');
    expect(resolveActionCentreRole('driver')).toBe('driver');
    expect(resolveActionCentreRole('owner_driver')).toBe('driver');
  });
});

describe('Action Centre role safety policy', () => {
  it('forbids admin-only entities and labels from non-admin roles', () => {
    expect(isActionCentreEventVisibleToRole('broker', 'fraud_review_opened', 'fraud_case')).toBe(false);
    expect(isActionCentreEventVisibleToRole('customer', 'admin_membership_changed', 'membership')).toBe(false);
    expect(isActionCentreEventVisibleToRole('driver', 'owner_policy_update', 'platform')).toBe(false);
  });

  it('allows operational entities per role and keeps CTA routes role-scoped', () => {
    const brokerHref = resolveRoleScopedHref('broker', 'job', 'evt-1');
    const customerHref = resolveRoleScopedHref('customer', 'invoice', 'evt-2');
    const driverHref = resolveRoleScopedHref('driver', 'vehicle', 'evt-3');

    expect(brokerHref.startsWith(ACTION_CENTRE_ROLE_PREFIX.broker)).toBe(true);
    expect(customerHref.startsWith(ACTION_CENTRE_ROLE_PREFIX.customer)).toBe(true);
    expect(driverHref.startsWith(ACTION_CENTRE_ROLE_PREFIX.driver)).toBe(true);

    expect(brokerHref.startsWith('/admin/')).toBe(false);
    expect(customerHref.startsWith('/admin/')).toBe(false);
    expect(driverHref.startsWith('/admin/')).toBe(false);
  });

  it('uses event fallback route when no scoped entity route exists', () => {
    expect(resolveRoleScopedHref('broker', 'unknown_entity', 'evt-123')).toBe(getActionCentreRoute('broker', 'evt-123'));
  });

  it('rejects cross-role action-centre API requests', () => {
    expect(isActionCentreRoleAllowed('broker', 'broker')).toBe(true);
    expect(isActionCentreRoleAllowed('broker', 'customer')).toBe(false);
    expect(isActionCentreRoleAllowed('customer', 'broker')).toBe(false);
    expect(isActionCentreRoleAllowed('driver', 'owner_driver')).toBe(true);
    expect(isActionCentreRoleAllowed('admin', 'dispatcher')).toBe(true);
    expect(isActionCentreRoleAllowed('admin', 'broker')).toBe(false);
  });
});

describe('Action Centre CTA route verification matrix', () => {
  const expectedRoutes = [
    '/admin/jobs',
    '/admin/quotes',
    '/admin/invoices',
    '/admin/disputes',
    '/broker/jobs',
    '/broker/bids',
    '/broker/customer-invoices',
    '/broker/disputes',
    '/customer/deliveries',
    '/customer/quotes',
    '/customer/invoices',
    '/driver/jobs',
    '/driver/quotes',
    '/driver/finance',
    '/driver/vehicles',
  ];

  it.each(expectedRoutes)('ensures %s route exists for CTA usage', (route) => {
    const routeFile = resolve(process.cwd(), 'app', route.replace(/^\//, ''), 'page.tsx');
    expect(existsSync(routeFile), `${route} page.tsx should exist`).toBe(true);
  });
});
