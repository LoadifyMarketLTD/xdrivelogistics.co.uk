import { describe, expect, it } from 'vitest';
import { isRoleAllowedForPath } from '../lib/authRole';

const active = { accountStatus: 'active', companyStatus: 'active' } as const;

describe('Customer and Broker company subrole boundaries', () => {
  it('keeps Customer viewer read-only', () => {
    const context = { ...active, workspaceRole: 'customer' as const, membershipRole: 'viewer' };
    for (const path of ['/customer', '/customer/loads', '/customer/quotes', '/customer/bookings', '/customer/tracking', '/customer/messages', '/customer/event-log']) {
      expect(isRoleAllowedForPath(path, 'customer', context)).toBe(true);
    }
    for (const path of ['/customer/post-load', '/customer/awards', '/customer/documents', '/customer/invoices', '/customer/team', '/customer/settings']) {
      expect(isRoleAllowedForPath(path, 'customer', context)).toBe(false);
    }
  });

  it('gives Customer dispatcher operational but not administrative/finance authority', () => {
    const context = { ...active, workspaceRole: 'customer' as const, membershipRole: 'dispatcher' };
    for (const path of ['/customer/post-load', '/customer/quotes', '/customer/awards', '/customer/bookings', '/customer/tracking', '/customer/documents', '/customer/disputes']) {
      expect(isRoleAllowedForPath(path, 'customer', context)).toBe(true);
    }
    for (const path of ['/customer/invoices', '/customer/team', '/customer/settings']) {
      expect(isRoleAllowedForPath(path, 'customer', context)).toBe(false);
    }
  });

  it('keeps Broker viewer read-only', () => {
    const context = { ...active, workspaceRole: 'broker' as const, membershipRole: 'viewer' };
    for (const path of ['/broker', '/broker/loads', '/broker/bids', '/broker/jobs', '/broker/diary', '/broker/messages', '/broker/event-log']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(true);
    }
    for (const path of ['/broker/post-load', '/broker/compare-quotes', '/broker/awards', '/broker/pod-review', '/broker/disputes', '/broker/finance', '/broker/team', '/broker/settings', '/broker/customers', '/broker/carrier-network']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(false);
    }
  });

  it('gives Broker dispatcher operational quote/POD authority without admin, dispute, or finance authority', () => {
    const context = { ...active, workspaceRole: 'broker' as const, membershipRole: 'dispatcher' };
    for (const path of ['/broker/post-load', '/broker/compare-quotes', '/broker/awards', '/broker/jobs', '/broker/diary', '/broker/pod-review']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(true);
    }
    for (const path of ['/broker/disputes', '/broker/finance', '/broker/margins', '/broker/team', '/broker/settings', '/broker/customers', '/broker/carrier-network']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(false);
    }
  });

  it('preserves full Customer/Broker workspace capabilities for owner/admin membership', () => {
    expect(isRoleAllowedForPath('/customer/settings', 'customer', { ...active, workspaceRole: 'customer', membershipRole: 'admin' })).toBe(true);
    expect(isRoleAllowedForPath('/customer/invoices', 'customer', { ...active, workspaceRole: 'customer', membershipRole: 'admin' })).toBe(true);
    expect(isRoleAllowedForPath('/broker/settings', 'broker', { ...active, workspaceRole: 'broker', membershipRole: 'admin' })).toBe(true);
    expect(isRoleAllowedForPath('/broker/finance', 'broker', { ...active, workspaceRole: 'broker', membershipRole: 'admin' })).toBe(true);
  });
});
