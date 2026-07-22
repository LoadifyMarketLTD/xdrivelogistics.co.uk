import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { normalizeProfileRoleForStorage, type AppUserRole } from '../../../../lib/authRole';
import { getWorkspaceHomeRoute } from '../../../../lib/workspaceRole';

const switchWorkspaceSchema = z.object({
  companyId: z.string().uuid(),
});

type MembershipRow = {
  id: string;
  company_id: string;
  role_in_company: string;
  status: string;
  companies:
    | {
        id: string;
        name: string | null;
        company_type: string | null;
        status: string | null;
      }
    | Array<{
        id: string;
        name: string | null;
        company_type: string | null;
        status: string | null;
      }>
    | null;
};

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const normalized = (value: string | null | undefined) => (value ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');
const firstCompany = (row: MembershipRow) => Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies;

const resolveTargetRole = ({
  companyType,
  membershipRole,
  hasDriverRecord,
}: {
  companyType: string | null;
  membershipRole: string;
  hasDriverRecord: boolean;
}): { appRole: AppUserRole; rawRole: string; ownerDriverWorkspace: boolean } => {
  const type = normalized(companyType);
  const membership = normalized(membershipRole);

  if (type.includes('owner_driver') || type.includes('owner_operator') || type.includes('sole_trader')) {
    return { appRole: hasDriverRecord ? 'driver' : 'company_admin', rawRole: 'owner_driver', ownerDriverWorkspace: true };
  }

  if (type.includes('broker')) {
    return { appRole: 'broker', rawRole: 'broker', ownerDriverWorkspace: false };
  }

  if (type.includes('customer') || type === 'shipper' || type.includes('customer_shipper')) {
    return { appRole: 'customer', rawRole: 'customer', ownerDriverWorkspace: false };
  }

  if (hasDriverRecord && membership === 'member') {
    return { appRole: 'driver', rawRole: 'driver', ownerDriverWorkspace: false };
  }

  if (membership === 'owner' || membership === 'admin') {
    return { appRole: 'company_admin', rawRole: type.includes('fleet') ? 'fleet_operator' : 'company_admin', ownerDriverWorkspace: false };
  }

  if (membership === 'dispatcher' || membership === 'finance' || membership === 'member') {
    return { appRole: 'company_staff', rawRole: membership, ownerDriverWorkspace: false };
  }

  return { appRole: 'customer', rawRole: 'customer', ownerDriverWorkspace: false };
};

const authenticate = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Server auth is not configured.' }), user: null };
  }

  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized.' }), user: null };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  if (error || !data.user) return { error: json(401, { error: 'Unauthorized: invalid token.' }), user: null };

  return { error: null, user: data.user };
};

const loadMemberships = async (userId: string) => {
  if (!supabaseAdmin) return { rows: [] as MembershipRow[], error: 'Server auth is not configured.' };

  const { data, error } = await supabaseAdmin
    .from('company_memberships')
    .select('id, company_id, role_in_company, status, companies!inner(id, name, company_type, status)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) return { rows: [] as MembershipRow[], error: error.message };

  const rows = ((data ?? []) as MembershipRow[]).filter((row) => {
    const company = firstCompany(row);
    const companyStatus = normalized(company?.status);
    return company && companyStatus !== 'blocked' && companyStatus !== 'suspended' && companyStatus !== 'deleted';
  });

  return { rows, error: null };
};

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error || !auth.user) return auth.error;

  const [{ rows, error }, profileResult] = await Promise.all([
    loadMemberships(auth.user.id),
    supabaseAdmin!
      .from('profiles')
      .select('company_id')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
  ]);

  if (error) return json(500, { error });
  if (profileResult.error) return json(500, { error: profileResult.error.message });

  return json(200, {
    activeCompanyId: profileResult.data?.company_id ?? null,
    workspaces: rows.map((row) => {
      const company = firstCompany(row)!;
      return {
        membershipId: row.id,
        companyId: row.company_id,
        companyName: company.name ?? 'Company workspace',
        companyType: company.company_type,
        membershipRole: row.role_in_company,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error || !auth.user) return auth.error;

  const parsed = switchWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'A valid companyId is required.' });

  const { rows, error } = await loadMemberships(auth.user.id);
  if (error) return json(500, { error });

  const selected = rows.find((row) => row.company_id === parsed.data.companyId);
  if (!selected) return json(403, { error: 'You do not have an active membership for this company.' });

  const [profileResult, driverResult] = await Promise.all([
    supabaseAdmin!
      .from('profiles')
      .select('role')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    supabaseAdmin!
      .from('drivers')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('company_id', selected.company_id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) return json(500, { error: profileResult.error.message });
  if (driverResult.error) return json(500, { error: driverResult.error.message });

  const company = firstCompany(selected)!;
  const target = resolveTargetRole({
    companyType: company.company_type,
    membershipRole: selected.role_in_company,
    hasDriverRecord: Boolean(driverResult.data?.id),
  });
  const storedRole = normalizeProfileRoleForStorage(target.appRole);

  const { error: profileUpdateError } = await supabaseAdmin!
    .from('profiles')
    .update({
      company_id: selected.company_id,
      ...(storedRole ? { role: storedRole } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', auth.user.id);

  if (profileUpdateError) return json(500, { error: profileUpdateError.message });

  const existingMetadata = (auth.user.user_metadata ?? {}) as Record<string, unknown>;
  const { error: metadataError } = await supabaseAdmin!.auth.admin.updateUserById(auth.user.id, {
    user_metadata: {
      ...existingMetadata,
      role: target.rawRole,
      requested_role: target.rawRole,
      workspace_mode: target.ownerDriverWorkspace ? 'owner_driver' : target.rawRole,
      owner_driver_workspace: target.ownerDriverWorkspace,
      active_company_id: selected.company_id,
      active_membership_id: selected.id,
    },
  });

  if (metadataError) return json(500, { error: metadataError.message });

  const route = getWorkspaceHomeRoute({
    role: target.appRole,
    rawRole: target.rawRole,
    membershipRole: selected.role_in_company,
    ownerDriverWorkspace: target.ownerDriverWorkspace,
  });

  return json(200, {
    success: true,
    route,
    activeCompanyId: selected.company_id,
    activeMembershipId: selected.id,
    workspaceRole: target.rawRole,
  });
}
