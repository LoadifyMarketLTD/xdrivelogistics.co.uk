import { describe, expect, it } from 'vitest';

import type { RawMembershipRow } from '../lib/activeWorkspace';
import { resolveSharedUiContext } from '../lib/sharedUiContext';

const membership = (input: {
  id?: string;
  companyId: string;
  companyName?: string;
  companyType?: string;
  membershipRole?: string;
  membershipStatus?: string;
  companyStatus?: string;
}): RawMembershipRow => ({
  id: input.id ?? `membership-${input.companyId}`,
  company_id: input.companyId,
  user_id: 'user-1',
  role_in_company: input.membershipRole ?? 'owner',
  status: input.membershipStatus ?? 'active',
  companies: {
    id: input.companyId,
    name: input.companyName ?? `Company ${input.companyId}`,
    company_type: input.companyType ?? 'standard',
    status: input.companyStatus ?? 'active',
  },
});

describe('resolveSharedUiContext', () => {
  it('requires explicit company selection for multiple active memberships', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({ companyId: 'company-a' }),
        membership({ companyId: 'company-b', companyType: 'broker' }),
      ],
      userId: 'user-1',
    });

    expect(result).toEqual({
      ok: true,
      snapshot: {
        memberships: expect.arrayContaining([
          expect.objectContaining({ companyId: 'company-a' }),
          expect.objectContaining({ companyId: 'company-b' }),
        ]),
        current: null,
        companySelectionRequired: true,
        workspaceSelectionRequired: false,
      },
    });
  });

  it('rejects cross-company and stale profile selections', () => {
    const result = resolveSharedUiContext({
      memberships: [membership({ companyId: 'company-a' })],
      profileCompanyId: 'company-other',
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'company_not_available' });
  });

  it('rejects a workspace not enabled for the selected company', () => {
    const result = resolveSharedUiContext({
      memberships: [membership({ companyId: 'company-a', companyType: 'standard' })],
      requestedCompanyId: 'company-a',
      requestedWorkspace: 'broker',
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('allows an owner-driver company only with active same-company driver evidence', () => {
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
          id: 'driver-1',
          user_id: 'user-1',
          company_id: 'owner-driver-company',
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
          companyId: 'owner-driver-company',
          activeWorkspace: 'owner_operator',
          landingRoute: '/driver',
          driverId: 'driver-1',
          canAccessDriverMode: true,
        }),
      }),
    });
  });

  it('fails closed when a driver identity lacks active same-company evidence', () => {
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
          id: 'driver-other',
          user_id: 'user-1',
          company_id: 'other-company',
          status: 'active',
          app_access: true,
        },
      ],
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'driver_context_required' });
  });

  it('keeps a valid company driver on the shared /driver surface', () => {
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
          activeWorkspace: 'carrier_fleet',
          landingRoute: '/driver',
          canAccessDriverMode: true,
        }),
      }),
    });
  });

  it('lands a non-driver carrier owner on /admin', () => {
    const result = resolveSharedUiContext({
      memberships: [membership({ companyId: 'carrier-company', companyType: 'standard' })],
      requestedCompanyId: 'carrier-company',
      requestedWorkspace: 'carrier_fleet',
      userId: 'user-1',
    });

    expect(result).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        current: expect.objectContaining({
          activeWorkspace: 'carrier_fleet',
          landingRoute: '/admin',
          canAccessDriverMode: false,
        }),
      }),
    });
  });

  it('excludes inactive memberships and inactive companies', () => {
    const result = resolveSharedUiContext({
      memberships: [
        membership({ companyId: 'inactive-membership', membershipStatus: 'suspended' }),
        membership({ companyId: 'inactive-company', companyStatus: 'suspended' }),
      ],
      userId: 'user-1',
    });

    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });
});
