import { describe, it, expect } from 'vitest';
import {
  type RawMembershipRow,
  resolveActiveCompanyContext,
  resolveEnabledWorkspacesForCompany,
} from '../lib/activeWorkspace';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── 1. resolveEnabledWorkspacesForCompany — fail-closed unknown types ─────────

describe('resolveEnabledWorkspacesForCompany — fail closed for unknown types', () => {
  it('maps customer → [shipper]', () => {
    expect(resolveEnabledWorkspacesForCompany('customer')).toEqual(['shipper']);
  });

  it('maps shipper → [shipper]', () => {
    expect(resolveEnabledWorkspacesForCompany('shipper')).toEqual(['shipper']);
  });

  it('maps broker → [broker]', () => {
    expect(resolveEnabledWorkspacesForCompany('broker')).toEqual(['broker']);
  });

  it('maps standard → [carrier_fleet]', () => {
    expect(resolveEnabledWorkspacesForCompany('standard')).toEqual(['carrier_fleet']);
  });

  it('maps carrier → [carrier_fleet]', () => {
    expect(resolveEnabledWorkspacesForCompany('carrier')).toEqual(['carrier_fleet']);
  });

  it('maps fleet → [carrier_fleet]', () => {
    expect(resolveEnabledWorkspacesForCompany('fleet')).toEqual(['carrier_fleet']);
  });

  it('is case-insensitive', () => {
    expect(resolveEnabledWorkspacesForCompany('BROKER')).toEqual(['broker']);
    expect(resolveEnabledWorkspacesForCompany('Customer')).toEqual(['shipper']);
    expect(resolveEnabledWorkspacesForCompany('STANDARD')).toEqual(['carrier_fleet']);
  });

  // ── Fail-closed for unknown types ─────────────────────────────────────────

  it('null → [] (fail closed — no default to carrier_fleet)', () => {
    expect(resolveEnabledWorkspacesForCompany(null)).toEqual([]);
  });

  it('empty string → [] (fail closed)', () => {
    expect(resolveEnabledWorkspacesForCompany('')).toEqual([]);
  });

  it('unknown string → [] (fail closed)', () => {
    expect(resolveEnabledWorkspacesForCompany('unknown')).toEqual([]);
    expect(resolveEnabledWorkspacesForCompany('organisation')).toEqual([]);
    expect(resolveEnabledWorkspacesForCompany('enterprise')).toEqual([]);
  });

  it('undefined → [] (fail closed)', () => {
    expect(resolveEnabledWorkspacesForCompany(undefined)).toEqual([]);
  });
});

// ── 2. Basic resolution ───────────────────────────────────────────────────────

describe('resolveActiveCompanyContext — basic resolution', () => {
  it('returns no_memberships when array is empty', () => {
    const result = resolveActiveCompanyContext([]);
    expect(result).toEqual({ ok: false, error: 'no_memberships' });
  });

  it('resolves a single active membership with enabledWorkspaces and activeWorkspace', () => {
    const rows = [membership({ company_id: 'co-1' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe('co-1');
      expect(result.context.membershipRole).toBe('owner');
      expect(result.context.enabledWorkspaces).toContain('carrier_fleet');
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
      expect(result.context.isActive).toBe(true);
    }
  });

  it('context no longer exposes a single .workspace field', () => {
    const rows = [membership({ company_id: 'co-1' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The new contract uses enabledWorkspaces + activeWorkspace
      expect('enabledWorkspaces' in result.context).toBe(true);
      expect('activeWorkspace' in result.context).toBe(true);
      // .workspace must NOT exist on the new context shape
      expect('workspace' in result.context).toBe(false);
    }
  });

  it('resolves a preferred company when multiple memberships exist', () => {
    const rows = [
      membership({ company_id: 'co-1' }),
      membership({ company_id: 'co-2' }),
    ];
    const result = resolveActiveCompanyContext(rows, { preferredCompanyId: 'co-2' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe('co-2');
    }
  });
});

// ── 3. No implicit cross-company fallback ─────────────────────────────────────

describe('resolveActiveCompanyContext — no cross-company fallback', () => {
  it('returns no_active_membership when multiple memberships and no preference', () => {
    const rows = [
      membership({ company_id: 'co-1' }),
      membership({ company_id: 'co-2' }),
    ];
    const result = resolveActiveCompanyContext(rows);
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });

  it('returns no_active_membership when preferred company not found in memberships', () => {
    const rows = [membership({ company_id: 'co-1' })];
    const result = resolveActiveCompanyContext(rows, { preferredCompanyId: 'co-999' });
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });
});

// ── 4. Active/inactive filtering ──────────────────────────────────────────────

describe('resolveActiveCompanyContext — active filtering', () => {
  it('ignores invited memberships', () => {
    const rows = [membership({ company_id: 'co-1', status: 'invited' })];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'no_active_membership',
    });
  });

  it('ignores suspended memberships', () => {
    const rows = [membership({ company_id: 'co-1', status: 'suspended' })];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'no_active_membership',
    });
  });

  it('ignores memberships with a suspended company', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: {
          id: 'co-1',
          name: 'Suspended Co',
          company_type: 'standard',
          status: 'suspended',
        },
      }),
    ];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'no_active_membership',
    });
  });

  it('uses the single active membership when others are inactive', () => {
    const rows = [
      membership({ company_id: 'co-inactive', status: 'suspended' }),
      membership({ company_id: 'co-active' }),
    ];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe('co-active');
    }
  });
});

// ── 5. workspace_not_enabled — unknown company type fails closed ──────────────

describe('resolveActiveCompanyContext — workspace_not_enabled', () => {
  it('returns workspace_not_enabled for null company_type', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Unknown Co', company_type: null, status: 'active' },
      }),
    ];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'workspace_not_enabled',
    });
  });

  it('returns workspace_not_enabled for empty company_type', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Unknown Co', company_type: '', status: 'active' },
      }),
    ];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'workspace_not_enabled',
    });
  });

  it('returns workspace_not_enabled for unrecognised company_type', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: {
          id: 'co-1', name: 'Weird Co', company_type: 'organisation', status: 'active',
        },
      }),
    ];
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'workspace_not_enabled',
    });
  });
});

// ── 6. Workspace mismatch guard ───────────────────────────────────────────────

describe('resolveActiveCompanyContext — workspace mismatch', () => {
  it('returns workspace_mismatch when company workspace differs from target pathname', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Shipper Co', company_type: 'customer', status: 'active' },
      }),
    ];
    // Shipper company targeting /admin (carrier_fleet)
    const result = resolveActiveCompanyContext(rows, {
      targetPathname: '/admin/marketplace',
    });
    expect(result).toEqual({ ok: false, error: 'workspace_mismatch' });
  });

  it('returns workspace_mismatch when preferredWorkspace is not in enabled set', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Carrier Co', company_type: 'standard', status: 'active' },
      }),
    ];
    // carrier_fleet company with shipper preferred workspace
    const result = resolveActiveCompanyContext(rows, {
      preferredWorkspace: 'shipper',
    });
    expect(result).toEqual({ ok: false, error: 'workspace_mismatch' });
  });

  it('resolves successfully when workspace matches target pathname', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Carrier Co', company_type: 'standard', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { targetPathname: '/admin/jobs' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
    }
  });

  it('resolves shipper company with /customer route', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Shipper Co', company_type: 'customer', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { targetPathname: '/customer/loads' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('shipper');
      expect(result.context.enabledWorkspaces).toContain('shipper');
    }
  });

  it('resolves without workspace check when no target given (auto-selects sole workspace)', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Shipper Co', company_type: 'customer', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('shipper');
    }
  });
});

// ── 7. preferredWorkspace selection ──────────────────────────────────────────

describe('resolveActiveCompanyContext — preferredWorkspace', () => {
  it('uses preferredWorkspace when it is in enabled set', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Carrier Co', company_type: 'carrier', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { preferredWorkspace: 'carrier_fleet' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
    }
  });

  it('targetPathname takes precedence over preferredWorkspace', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: { id: 'co-1', name: 'Carrier Co', company_type: 'standard', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, {
      preferredWorkspace: 'carrier_fleet',
      targetPathname: '/admin/jobs',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.activeWorkspace).toBe('carrier_fleet');
    }
  });
});

// ── 8. Membership role resolved from raw string ───────────────────────────────

describe('resolveActiveCompanyContext — membership role from raw string', () => {
  it('resolves null role_in_company to viewer', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: null })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.membershipRole).toBe('viewer');
    }
  });

  it('resolves dispatcher role correctly', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: 'dispatcher' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.membershipRole).toBe('dispatcher');
    }
  });

  it('preserves finance role — not downgraded to viewer', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: 'finance' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.membershipRole).toBe('finance');
    }
  });

  it('preserves compliance role — not downgraded to viewer', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: 'compliance' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.membershipRole).toBe('compliance');
    }
  });

  it('preserves driver role — not downgraded to viewer', () => {
    const rows = [membership({ company_id: 'co-1', role_in_company: 'driver' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.membershipRole).toBe('driver');
    }
  });
});

// ── 9. Multi-company / cross-company security ─────────────────────────────────

describe('multi-company cross-company security', () => {
  it('a user with two company memberships requires explicit company selection', () => {
    const rows = [
      membership({ company_id: 'company-a' }),
      membership({ company_id: 'company-b' }),
    ];
    // No preference — must NOT silently pick company-a
    expect(resolveActiveCompanyContext(rows)).toEqual({
      ok: false, error: 'no_active_membership',
    });
  });

  it('explicit preferredCompanyId selects the correct company', () => {
    const rows = [
      membership({ company_id: 'company-a' }),
      membership({
        company_id: 'company-b',
        companies: { id: 'company-b', name: 'B Corp', company_type: 'broker', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { preferredCompanyId: 'company-b' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe('company-b');
      expect(result.context.activeWorkspace).toBe('broker');
    }
  });

  it('a suspended company does not grant access even when preferredCompanyId matches', () => {
    const rows = [
      membership({
        company_id: 'co-suspended',
        companies: {
          id: 'co-suspended', name: 'Gone Co', company_type: 'standard', status: 'suspended',
        },
      }),
    ];
    expect(resolveActiveCompanyContext(rows, { preferredCompanyId: 'co-suspended' })).toEqual({
      ok: false, error: 'no_active_membership',
    });
  });

  it('shipper membership cannot navigate to carrier_fleet route', () => {
    const rows = [
      membership({
        company_id: 'shipper-co',
        companies: { id: 'shipper-co', name: 'Shipper', company_type: 'customer', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { targetPathname: '/admin/jobs' });
    expect(result).toEqual({ ok: false, error: 'workspace_mismatch' });
  });

  it('carrier membership cannot navigate to shipper route', () => {
    const rows = [
      membership({
        company_id: 'carrier-co',
        companies: { id: 'carrier-co', name: 'Carrier', company_type: 'standard', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { targetPathname: '/customer/loads' });
    expect(result).toEqual({ ok: false, error: 'workspace_mismatch' });
  });

  it('broker membership cannot navigate to owner_operator route', () => {
    const rows = [
      membership({
        company_id: 'broker-co',
        companies: { id: 'broker-co', name: 'Broker', company_type: 'broker', status: 'active' },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, { targetPathname: '/driver/jobs' });
    expect(result).toEqual({ ok: false, error: 'workspace_mismatch' });
  });
});
