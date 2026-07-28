import { describe, it, expect } from 'vitest';
import {
  type RawMembershipRow,
  resolveActiveCompanyContext,
  resolveWorkspaceForCompany,
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

// ── 1. Basic resolution ───────────────────────────────────────────────────────

describe('resolveActiveCompanyContext — basic resolution', () => {
  it('returns no_memberships when array is empty', () => {
    const result = resolveActiveCompanyContext([]);
    expect(result).toEqual({ ok: false, error: 'no_memberships' });
  });

  it('resolves a single active membership automatically', () => {
    const rows = [membership({ company_id: 'co-1' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.companyId).toBe('co-1');
      expect(result.context.membershipRole).toBe('owner');
      expect(result.context.workspace).toBe('carrier_fleet');
      expect(result.context.isActive).toBe(true);
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

// ── 2. No implicit cross-company fallback ─────────────────────────────────────

describe('resolveActiveCompanyContext — no cross-company fallback', () => {
  it('returns no_active_membership when multiple memberships and no preference', () => {
    const rows = [
      membership({ company_id: 'co-1' }),
      membership({ company_id: 'co-2' }),
    ];
    // No preferredCompanyId — must NOT silently pick the first one
    const result = resolveActiveCompanyContext(rows);
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });

  it('returns no_active_membership when preferred company not found in memberships', () => {
    const rows = [membership({ company_id: 'co-1' })];
    const result = resolveActiveCompanyContext(rows, { preferredCompanyId: 'co-999' });
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });
});

// ── 3. Active/inactive filtering ──────────────────────────────────────────────

describe('resolveActiveCompanyContext — active filtering', () => {
  it('ignores invited memberships', () => {
    const rows = [membership({ company_id: 'co-1', status: 'invited' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
  });

  it('ignores suspended memberships', () => {
    const rows = [membership({ company_id: 'co-1', status: 'suspended' })];
    const result = resolveActiveCompanyContext(rows);
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
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
    const result = resolveActiveCompanyContext(rows);
    expect(result).toEqual({ ok: false, error: 'no_active_membership' });
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

// ── 4. Workspace mismatch guard ───────────────────────────────────────────────

describe('resolveActiveCompanyContext — workspace mismatch', () => {
  it('returns workspace_mismatch when company workspace differs from target', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: {
          id: 'co-1',
          name: 'Shipper Co',
          company_type: 'customer',
          status: 'active',
        },
      }),
    ];
    // User is in a shipper company but targeting /admin (carrier_fleet)
    const result = resolveActiveCompanyContext(rows, {
      targetPathname: '/admin/marketplace',
    });
    expect(result).toEqual({ ok: false, error: 'workspace_mismatch' });
  });

  it('resolves successfully when workspace matches target pathname', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: {
          id: 'co-1',
          name: 'Carrier Co',
          company_type: 'standard',
          status: 'active',
        },
      }),
    ];
    const result = resolveActiveCompanyContext(rows, {
      targetPathname: '/admin/jobs',
    });
    expect(result.ok).toBe(true);
  });

  it('resolves without workspace check when no target is given', () => {
    const rows = [
      membership({
        company_id: 'co-1',
        companies: {
          id: 'co-1',
          name: 'Shipper Co',
          company_type: 'customer',
          status: 'active',
        },
      }),
    ];
    const result = resolveActiveCompanyContext(rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.workspace).toBe('shipper');
    }
  });
});

// ── 5. resolveWorkspaceForCompany ─────────────────────────────────────────────

describe('resolveWorkspaceForCompany', () => {
  it('maps customer → shipper', () => {
    expect(resolveWorkspaceForCompany('customer')).toBe('shipper');
  });

  it('maps shipper → shipper', () => {
    expect(resolveWorkspaceForCompany('shipper')).toBe('shipper');
  });

  it('maps broker → broker', () => {
    expect(resolveWorkspaceForCompany('broker')).toBe('broker');
  });

  it('maps standard → carrier_fleet', () => {
    expect(resolveWorkspaceForCompany('standard')).toBe('carrier_fleet');
  });

  it('maps carrier → carrier_fleet', () => {
    expect(resolveWorkspaceForCompany('carrier')).toBe('carrier_fleet');
  });

  it('maps fleet → carrier_fleet', () => {
    expect(resolveWorkspaceForCompany('fleet')).toBe('carrier_fleet');
  });

  it('maps null → carrier_fleet (safe default)', () => {
    expect(resolveWorkspaceForCompany(null)).toBe('carrier_fleet');
  });

  it('maps empty string → carrier_fleet', () => {
    expect(resolveWorkspaceForCompany('')).toBe('carrier_fleet');
  });

  it('is case-insensitive', () => {
    expect(resolveWorkspaceForCompany('BROKER')).toBe('broker');
    expect(resolveWorkspaceForCompany('Customer')).toBe('shipper');
  });
});

// ── 6. Membership role resolved from raw string ───────────────────────────────

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
});
