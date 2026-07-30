import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import type { RawMembershipRow } from '../lib/activeWorkspace';
import { resolveSharedUiContext } from '../lib/sharedUiContext';
import {
  filterAuthorizedNavigation,
  shouldShowCompanySwitcher,
  shouldShowWorkspaceSwitcher,
} from '../lib/sharedUiNavigation';

const membership = (input: {
  companyId: string;
  companyType?: string;
  membershipRole?: string;
  membershipStatus?: string;
  companyStatus?: string;
  userId?: string;
}): RawMembershipRow => ({
  id: `membership-${input.companyId}`,
  company_id: input.companyId,
  user_id: input.userId ?? 'user-1',
  role_in_company: input.membershipRole ?? 'owner',
  status: input.membershipStatus ?? 'active',
  companies: {
    id: input.companyId,
    name: `Company ${input.companyId}`,
    company_type: input.companyType ?? 'standard',
    status: input.companyStatus ?? 'active',
  },
});

describe('Phase 2 Shared UI — authoritative company and workspace context', () => {
  it('fails closed for a cross-company selection', () => {
    const result = resolveSharedUiContext({
      memberships: [membership({ companyId: 'company-a' })],
      requestedCompanyId: 'company-other',
      requestedWorkspace: 'carrier_fleet',
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'company_not_available' });
  });

  it('excludes inactive memberships and inactive companies', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({
          companyId: 'membership-suspended',
          membershipStatus: 'suspended',
        }),
        membership({
          companyId: 'company-suspended',
          companyStatus: 'suspended',
        }),
      ],
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });

  it('rejects a workspace not enabled by the selected canonical company', () => {
    const result = resolveSharedUiContext({
      memberships: [membership({ companyId: 'carrier-company', companyType: 'standard' })],
      requestedCompanyId: 'carrier-company',
      requestedWorkspace: 'broker',
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('keeps a valid Company Driver on the shared /driver surface', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({
          companyId: 'carrier-company',
          companyType: 'standard',
          membershipRole: 'driver',
        }),
      ],
      requestedCompanyId: 'carrier-company',
      requestedWorkspace: 'carrier_fleet',
      drivers: [
        {
          id: 'driver-1',
          user_id: 'user-1',
          company_id: 'carrier-company',
          status: 'active',
          app_access: true,
        },
      ],
      userId: 'user-1',
    });

    expect(result).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        current: expect.objectContaining({
          companyId: 'carrier-company',
          activeWorkspace: 'carrier_fleet',
          landingRoute: '/driver',
          driverId: 'driver-1',
          canAccessDriverMode: true,
        }),
      }),
    });
  });

  it('never redirects a Driver without active same-company evidence to /admin', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({
          companyId: 'carrier-company',
          companyType: 'standard',
          membershipRole: 'driver',
        }),
      ],
      requestedCompanyId: 'carrier-company',
      requestedWorkspace: 'carrier_fleet',
      drivers: [],
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'driver_context_required' });
  });

  it('allows an Owner Driver only with valid same-company Driver evidence', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({
          companyId: 'owner-driver-company',
          companyType: 'owner_driver',
          membershipRole: 'driver',
        }),
      ],
      requestedCompanyId: 'owner-driver-company',
      requestedWorkspace: 'owner_operator',
      drivers: [
        {
          id: 'owner-driver-1',
          user_id: 'user-1',
          company_id: 'owner-driver-company',
          status: 'active',
          app_access: true,
        },
      ],
      userId: 'user-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.current?.landingRoute).toBe('/driver');
      expect(result.snapshot.current?.activeWorkspace).toBe('owner_operator');
    }
  });

  it('lands a non-driver Carrier/Fleet owner on /admin', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({
          companyId: 'carrier-company',
          companyType: 'standard',
          membershipRole: 'owner',
        }),
      ],
      requestedCompanyId: 'carrier-company',
      requestedWorkspace: 'carrier_fleet',
      drivers: [],
      userId: 'user-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.current?.landingRoute).toBe('/admin');
      expect(result.snapshot.current?.canAccessDriverMode).toBe(false);
    }
  });
});

describe('Phase 2 Shared UI — navigation-only search', () => {
  const authorizedNavigation = [
    { id: 'dashboard', label: 'Carrier Dashboard', href: '/admin' },
    { id: 'marketplace', label: 'Marketplace', href: '/admin/marketplace' },
    { id: 'jobs', label: 'Jobs', href: '/admin/jobs' },
    { id: 'drivers', label: 'Drivers', href: '/admin/drivers' },
  ];

  it('returns no results for an empty query', () => {
    expect(filterAuthorizedNavigation(authorizedNavigation, '')).toEqual([]);
  });

  it('filters only the authorised navigation collection passed by the shell', () => {
    expect(filterAuthorizedNavigation(authorizedNavigation, 'market')).toEqual([
      { id: 'marketplace', label: 'Marketplace', href: '/admin/marketplace' },
    ]);

    expect(
      filterAuthorizedNavigation(authorizedNavigation, '/broker'),
    ).toEqual([]);
  });

  it('enforces the configured result limit', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: `job-${index}`,
      label: `Job ${index}`,
      href: `/admin/jobs/${index}`,
    }));

    expect(filterAuthorizedNavigation(many, 'job', 8)).toHaveLength(8);
  });
});

describe('Phase 2 Shared UI — switcher visibility', () => {
  it('shows the Company switcher only for multiple memberships', () => {
    expect(shouldShowCompanySwitcher(0)).toBe(false);
    expect(shouldShowCompanySwitcher(1)).toBe(false);
    expect(shouldShowCompanySwitcher(2)).toBe(true);
  });

  it('shows the Workspace switcher only for multiple enabled workspaces', () => {
    expect(shouldShowWorkspaceSwitcher(0)).toBe(false);
    expect(shouldShowWorkspaceSwitcher(1)).toBe(false);
    expect(shouldShowWorkspaceSwitcher(2)).toBe(true);
  });
});

describe('Phase 2 Shared UI — notification deduplication', () => {
  it('does not mount a second NotificationBell in the Admin layout', () => {
    const layoutSource = readFileSync(
      new URL('../app/admin/layout.tsx', import.meta.url),
      'utf-8',
    );

    expect(layoutSource).not.toContain('import NotificationBell');
    expect(layoutSource).not.toContain('<NotificationBell');
    expect(layoutSource).toContain('<AdminPlatformShell>');
  });
});
