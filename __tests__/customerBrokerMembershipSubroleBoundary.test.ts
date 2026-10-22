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
    for (const path of ['/broker', '/broker/loads', '/broker/bids', '/broker/jobs', '/broker/diary', '/broker/messages', '/broker/event-log', '/broker/carrier-network/directory']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(true);
    }
    for (const path of ['/broker/post-load', '/broker/compare-quotes', '/broker/awards', '/broker/pod-review', '/broker/disputes', '/broker/finance', '/broker/team', '/broker/settings', '/broker/customers', '/broker/carrier-network']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(false);
    }
  });

  it('gives Broker dispatcher operational quote/POD authority without admin, dispute, or finance authority', () => {
    const context = { ...active, workspaceRole: 'broker' as const, membershipRole: 'dispatcher' };
    for (const path of ['/broker/post-load', '/broker/compare-quotes', '/broker/awards', '/broker/jobs', '/broker/diary', '/broker/pod-review', '/broker/carrier-network/directory']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(true);
    }
    for (const path of ['/broker/disputes', '/broker/finance', '/broker/margins', '/broker/team', '/broker/settings', '/broker/customers', '/broker/carrier-network']) {
      expect(isRoleAllowedForPath(path, 'broker', context)).toBe(false);
    }
  });

  it('keeps ordinary Customer/Broker members finance-enabled without granting admin or dispatch authority', () => {
    const customer = { ...active, workspaceRole: 'customer' as const, membershipRole: 'member' };
    expect(isRoleAllowedForPath('/customer/invoices', 'customer', customer)).toBe(true);
    for (const path of ['/customer/post-load', '/customer/awards', '/customer/documents', '/customer/team', '/customer/settings']) {
      expect(isRoleAllowedForPath(path, 'customer', customer)).toBe(false);
    }

    const broker = { ...active, workspaceRole: 'broker' as const, membershipRole: 'member' };
    for (const path of ['/broker/finance', '/broker/customer-invoices', '/broker/carrier-costs', '/broker/margins']) {
      expect(isRoleAllowedForPath(path, 'broker', broker)).toBe(true);
    }
    for (const path of ['/broker/post-load', '/broker/compare-quotes', '/broker/awards', '/broker/pod-review', '/broker/disputes', '/broker/team', '/broker/settings', '/broker/customers', '/broker/carrier-network']) {
      expect(isRoleAllowedForPath(path, 'broker', broker)).toBe(false);
    }
  });

  it('allows a canonical Broker profile with member company membership to use the broker posting flow', () => {
    const broker = { ...active, workspaceRole: 'broker' as const, membershipRole: 'member', rawRole: 'broker' };
    expect(isRoleAllowedForPath('/broker/post-load', 'broker', broker)).toBe(true);
    expect(isRoleAllowedForPath('/broker/bulk-import', 'broker', broker)).toBe(true);
  });

  it('preserves full Customer/Broker workspace capabilities for owner/admin membership', () => {
    expect(isRoleAllowedForPath('/customer/settings', 'customer', { ...active, workspaceRole: 'customer', membershipRole: 'admin' })).toBe(true);
    expect(isRoleAllowedForPath('/customer/invoices', 'customer', { ...active, workspaceRole: 'customer', membershipRole: 'admin' })).toBe(true);
    expect(isRoleAllowedForPath('/broker/settings', 'broker', { ...active, workspaceRole: 'broker', membershipRole: 'admin' })).toBe(true);
    expect(isRoleAllowedForPath('/broker/finance', 'broker', { ...active, workspaceRole: 'broker', membershipRole: 'admin' })).toBe(true);
  });
});
