import { NextRequest } from 'next/server';
import { resolveAuthoritativeRole, type AppUserRole } from '../../../lib/authRole';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from './supabaseAdmin';

type AuthUser = {
  id: string;
  app_metadata?: { role?: string | null };
  email_confirmed_at?: string | null;
};

type ActorContext =
  | { error: string; status: number }
  | {
      user: AuthUser;
      role: AppUserRole | null;
      companyId: string | null;
      membershipRole: string | null;
      driverId: string | null;
      profileStatus: string | null;
      emailConfirmed: boolean;
    };

export const resolveActorContext = async (request: NextRequest): Promise<ActorContext> => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: 'Service not available — admin client not configured.', status: 503 };
  }

  const token = getBearerToken(request);
  if (!token) return { error: 'Unauthorized — no bearer token.', status: 401 };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Unauthorized — invalid token.', status: 401 };
  }

  const [profileRes, membershipRes, driverRes, creatorCompanyRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, status, is_driver, company_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('company_id, role_in_company')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('id, company_id')
      .eq('user_id', user.id)
      .neq('status', 'rejected')
      .neq('status', 'inactive')
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('companies')
      .select('id, company_type')
      .eq('created_by', user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as { role?: string | null; status?: string | null; is_driver?: boolean | null; company_id?: string | null } | null;
  const membership = membershipRes.data as { company_id?: string | null; role_in_company?: string | null } | null;
  const driver = driverRes.data as { id?: string | null; company_id?: string | null } | null;
  const creatorCompany = creatorCompanyRes.data as { id?: string | null; company_type?: string | null } | null;

  const role = resolveAuthoritativeRole({
    membershipRole: membership?.role_in_company ?? null,
    profileRole: profile?.role ?? null,
    isDriver: Boolean(driver?.id) || profile?.is_driver === true,
    hasCreatedCompany: Boolean(creatorCompany?.id),
    creatorCompanyType: creatorCompany?.company_type ?? null,
    fallbackRole: (user.app_metadata?.role as string | null | undefined) ?? null,
    ownerDriverWorkspaceRequested: false,
  });

  const companyId = membership?.company_id ?? profile?.company_id ?? driver?.company_id ?? creatorCompany?.id ?? null;

  return {
    user: user as AuthUser,
    role,
    companyId,
    membershipRole: membership?.role_in_company ?? null,
    driverId: driver?.id ?? null,
    profileStatus: profile?.status ?? null,
    emailConfirmed: Boolean((user as AuthUser).email_confirmed_at),
  };
};
