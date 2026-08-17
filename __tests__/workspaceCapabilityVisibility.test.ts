import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav, hasWorkspaceCapability } from '../lib/workspaceRole';

const visibleHrefs = (role: Parameters<typeof getVisibleWorkspaceNav>[0]) =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

describe('visible workspace navigation', () => {
  it('does not escalate carrier-admin access to mutable company settings', () => {
    expect(hasWorkspaceCapability('carrier_admin', 'settings.manage')).toBe(false);
    expect(visibleHrefs('carrier_admin')).not.toContain('/admin/settings');
  });

  it('keeps Account visible for company roles that already own settings.manage', () => {
    expect(hasWorkspaceCapability('company_owner', 'settings.manage')).toBe(true);
    expect(visibleHrefs('company_owner')).toContain('/admin/settings');
    expect(hasWorkspaceCapability('company_admin', 'settings.manage')).toBe(true);
    expect(visibleHrefs('company_admin')).toContain('/admin/settings');
  });

  it('keeps the full Customer canonical navigation visible', () => {
    expect(visibleHrefs('customer')).toEqual([
      '/customer',
      '/customer/loads',
      '/customer/quotes',
      '/customer/bookings',
      '/customer/tracking',
      '/customer/diary',
      '/customer/network',
      '/customer/account',
    ]);
  });

  it('keeps the Fleet Account entry visible', () => {
    expect(visibleHrefs('fleet_manager')).toContain('/admin/settings');
  });

  it('does not let a read-only viewer bypass quote capabilities through bidder identity API access', () => {
    expect(hasWorkspaceCapability('viewer', 'quotes.receive')).toBe(false);
    expect(hasWorkspaceCapability('viewer', 'quotes.compare')).toBe(false);

    const adminSource = fs.readFileSync(
      path.join(process.cwd(), 'app/api/admin/bids/identities/route.ts'),
      'utf8',
    );
    expect(adminSource).toContain("['owner', 'admin', 'dispatcher']");
    expect(adminSource).not.toContain("['owner', 'admin', 'dispatcher', 'viewer']");

    const sharedSource = fs.readFileSync(
      path.join(process.cwd(), 'app/api/workspace/bids/identities/route.ts'),
      'utf8',
    );
    expect(sharedSource).toContain("BID_DECISION_MEMBERSHIP_ROLES = new Set(['owner', 'admin', 'dispatcher'])");
    expect(sharedSource).not.toContain('BID_DECISION_APP_ROLES');
    expect(sharedSource).not.toContain('appRoleCanReviewBids ||');
    expect(sharedSource).toContain('.filter((row) => BID_DECISION_MEMBERSHIP_ROLES.has');
  });
});
