import {
  resolveActiveCompanyContext,
  type RawMembershipRow,
  type WorkspaceResolutionError,
} from './activeWorkspace';

export type AuthMembershipQueryRow = {
  id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  role_in_company?: string | null;
  status?: string | null;
  companies?:
    | {
        id?: string | null;
        name?: string | null;
        company_type?: string | null;
        status?: string | null;
      }
    | Array<{
        id?: string | null;
        name?: string | null;
        company_type?: string | null;
        status?: string | null;
      }>
    | null;
};

export const normalizeAuthMembershipRows = (
  rows: AuthMembershipQueryRow[],
): RawMembershipRow[] => {
  const normalized: RawMembershipRow[] = [];

  for (const row of rows) {
    const companyValue = Array.isArray(row.companies)
      ? row.companies[0] ?? null
      : row.companies ?? null;

    const membershipId = row.id ?? null;
    const companyId = row.company_id ?? null;
    const userId = row.user_id ?? null;
    const companyName = companyValue?.name ?? null;

    if (!membershipId || !companyId || !userId || !companyValue?.id || !companyName) {
      continue;
    }

    normalized.push({
      id: membershipId,
      company_id: companyId,
      user_id: userId,
      role_in_company: row.role_in_company ?? null,
      status: row.status ?? null,
      companies: {
        id: companyValue.id,
        name: companyName,
        company_type: companyValue.company_type ?? null,
        status: companyValue.status ?? null,
      },
    });
  }

  return normalized;
};

export type AuthActiveCompanySelection =
  | {
      ok: true;
      membership: RawMembershipRow;
      companyId: string;
      membershipId: string;
    }
  | {
      ok: false;
      error: WorkspaceResolutionError;
    };

export const resolveAuthActiveCompanySelection = (input: {
  memberships: RawMembershipRow[];
  preferredCompanyId?: string | null;
}): AuthActiveCompanySelection => {
  const selection = resolveActiveCompanyContext(input.memberships, {
    preferredCompanyId: input.preferredCompanyId ?? null,
  });

  if (!selection.ok) {
    return { ok: false, error: selection.error };
  }

  const selectedMembership = input.memberships.find(
    (membership) => membership.id === selection.context.membershipId,
  );
  if (!selectedMembership) {
    return { ok: false, error: 'no_active_membership' };
  }

  return {
    ok: true,
    membership: selectedMembership,
    companyId: selection.context.companyId,
    membershipId: selection.context.membershipId,
  };
};
