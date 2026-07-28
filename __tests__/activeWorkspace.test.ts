import { describe, it, expect } from 'vitest';
import {
  type RawMembershipRow,
  resolveActiveCompanyContext,
  resolveCompanyEnabledWorkspaces,
  resolveWorkspaceForCompany,
} from '../lib/activeWorkspace';

function membership(
  overrides: Partial<RawMembershipRow> & { company_id: string },
): RawMembershipRow {
  return {
    user_id: 'user-1',
    role_in_company: 'owner',
    status: 'active',
    companies: {
      id: overrides.company_id,
      name: `Company ${overrides.company_id}`,
      company_type: 'standard',
      status: 'active',
    },
    ...overrides,
  };
}

describe('resolveActiveCompanyContext', () => {
  it('returns no_memberships for an empty list', () => {
    expect(resolveActiveCompanyContext([])).toEqual({ ok: false, error: 'no_memberships' });
  });

  it('requires explicit company selection when multiple memberships exist', () => {
    const rows = [membership({ company_id: 'co-1' }), membership({ company_id: 'co-2' })];
    expect(resolveActiveCompanyContext(rows)).toEqual({ ok: false, error: 'active_company_required' });
  });

  it('auto-selects single workspace when company_type maps to exactly one workspace', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: 'owner' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.enabledWorkspaces).toEqual(['carrier_fleet']);
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
    }
  });

  it('fails closed when requested workspace is not enabled for selected company', () => {
    // standard company_type → only carrier_fleet; requesting broker must fail
    const rows = [membership({ company_id: 'co-1' })];

    expect(
      resolveActiveCompanyContext(rows, {
        activeWorkspace: 'broker',
      }),
    ).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('prevents workspace leakage across companies', () => {
    const rows = [
      membership({
        company_id: 'carrier-co',
        companies: {
          id: 'carrier-co',
          name: 'Carrier Co',
          company_type: 'standard',
          status: 'active',
        },
      }),
      membership({
        company_id: 'broker-co',
        companies: {
          id: 'broker-co',
          name: 'Broker Co',
          company_type: 'broker',
          status: 'active',
        },
      }),
    ];

    expect(
      resolveActiveCompanyContext(rows, {
        preferredCompanyId: 'carrier-co',
        activeWorkspace: 'broker',
      }),
    ).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('resolves carrier_fleet workspace for finance role on standard company', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        role_in_company: 'finance',
        companies: {
          id: 'co-1',
          name: 'Carrier Co',
          company_type: 'standard',
          status: 'active',
        },
      }),
    ];

    const result = resolveActiveCompanyContext(rows, { activeWorkspace: 'carrier_fleet' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.membershipRole).toBe('finance');
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
      expect(result.context.enabledWorkspaces).toEqual(['carrier_fleet']);
    }
  });

  it('resolves when explicit enabledWorkspaces contains two workspaces and activeWorkspace is selected', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        role_in_company: 'admin',
        companies: {
          id: 'co-1',
          name: 'Multi-modal Co',
          company_type: 'standard',
          status: 'active',
        },
      }),
    ];

    const result = resolveActiveCompanyContext(rows, {
      enabledWorkspaces: ['carrier_fleet', 'broker'],
      activeWorkspace: 'broker',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.enabledWorkspaces).toContain('carrier_fleet');
      expect(result.context.enabledWorkspaces).toContain('broker');
      expect(result.context.activeWorkspace).toBe('broker');
    }
  });

  it('fails closed when activeWorkspace is not in the explicit enabledWorkspaces set', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        role_in_company: 'admin',
        companies: {
          id: 'co-1',
          name: 'Multi-modal Co',
          company_type: 'standard',
          status: 'active',
        },
      }),
    ];

    expect(
      resolveActiveCompanyContext(rows, {
        enabledWorkspaces: ['carrier_fleet', 'broker'],
        activeWorkspace: 'shipper',
      }),
    ).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('returns active_company_required (not no_active_membership) when multiple memberships exist without preferredCompanyId', () => {
    const rows = [
      membership({ company_id: 'co-1' }),
      membership({ company_id: 'co-2' }),
      membership({ company_id: 'co-3' }),
    ];
    const result = resolveActiveCompanyContext(rows);
    expect(result).toEqual({ ok: false, error: 'active_company_required' });
  });

  it('returns no_active_membership when preferredCompanyId is given but not found', () => {
    const rows = [membership({ company_id: 'co-1' })];
    expect(
      resolveActiveCompanyContext(rows, { preferredCompanyId: 'co-999' }),
    ).toEqual({ ok: false, error: 'no_active_membership' });
  });

  it('rejects unsupported membership role values', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: 'unknown-role' })];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false,
      error: 'unsupported_membership_role',
    });
  });

  it('rejects workspace mismatch between active workspace and route', () => {
    const rows = [membership({ company_id: 'co-1' })];
    expect(
      resolveActiveCompanyContext(rows, {
        activeWorkspace: 'carrier_fleet',
        targetPathname: '/customer/loads',
      }),
    ).toEqual({ ok: false, error: 'workspace_mismatch' });
  });

  it('rejects non-active company states (suspended/inactive/blocked)', () => {
    for (const status of ['suspended', 'inactive', 'blocked'] as const) {
      const rows = [
        membership({
          company_id: `co-${status}`,
          companies: {
            id: `co-${status}`,
            name: `Company ${status}`,
            company_type: 'standard',
            status,
          },
        }),
      ];

      expect(resolveActiveCompanyContext(rows)).toEqual({
        ok: false,
        error: 'no_active_membership',
      });
    }
  });
});

describe('resolveCompanyEnabledWorkspaces / resolveWorkspaceForCompany', () => {
  it('maps only explicitly recognized legacy types to carrier_fleet', () => {
    expect(resolveWorkspaceForCompany('standard')).toBe('carrier_fleet');
    expect(resolveWorkspaceForCompany('carrier')).toBe('carrier_fleet');
    expect(resolveWorkspaceForCompany('fleet')).toBe('carrier_fleet');
  });

  it('fails closed for null/empty/unknown company type without explicit enabled workspaces', () => {
    expect(resolveCompanyEnabledWorkspaces({ companyType: null })).toEqual({
      ok: false,
      error: 'unsupported_company_type',
    });
    expect(resolveCompanyEnabledWorkspaces({ companyType: '' })).toEqual({
      ok: false,
      error: 'unsupported_company_type',
    });
    expect(resolveCompanyEnabledWorkspaces({ companyType: 'mystery' })).toEqual({
      ok: false,
      error: 'unsupported_company_type',
    });
  });

  it('fails closed for explicitly disabled workspace lists', () => {
    expect(
      resolveCompanyEnabledWorkspaces({
        companyType: 'standard',
        enabledWorkspaces: [],
      }),
    ).toEqual({ ok: false, error: 'workspace_not_enabled' });
  });

  it('uses explicit enabled workspace set independently from company_type', () => {
    const result = resolveCompanyEnabledWorkspaces({
      companyType: null,
      enabledWorkspaces: ['broker', 'carrier_fleet'],
    });
    expect(result).toEqual({ ok: true, enabledWorkspaces: ['broker', 'carrier_fleet'] });
  });
});
