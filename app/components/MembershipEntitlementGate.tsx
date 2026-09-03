import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../api/_lib/supabaseAdmin';
import { resolveActiveCompanyContext, type RawMembershipRow } from '../../lib/activeWorkspace';
import {
  resolveMembershipEntitlement,
  type MembershipLifecycleStatus,
} from '../../lib/membershipEntitlement';
import { ROUTE_AUTH_COOKIE_NAME } from '../../lib/routeAuthCookie';

type WorkspacePath = '/admin' | '/broker' | '/customer' | '/driver';

type MembershipRow = {
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

type SubscriptionRow = {
  status?: MembershipLifecycleStatus | null;
  trial_ends_at?: string | null;
};

const billingRedirect = (reason: string): never => {
  redirect(`/settings/billing?reason=${encodeURIComponent(reason)}`);
};

const normalizeMembershipRows = (rows: MembershipRow[]): RawMembershipRow[] => {
  const normalized: RawMembershipRow[] = [];

  for (const row of rows) {
    const company = Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies ?? null;
    if (!row.id || !row.company_id || !row.user_id || !company?.id || !company.name) continue;

    normalized.push({
      id: row.id,
      company_id: row.company_id,
      user_id: row.user_id,
      role_in_company: row.role_in_company ?? null,
      status: row.status ?? null,
      companies: {
        id: company.id,
        name: company.name,
        company_type: company.company_type ?? null,
        status: company.status ?? null,
      },
    });
  }

  return normalized;
};

async function readSubscription(companyId: string | null, userId: string): Promise<SubscriptionRow | null> {
  if (!supabaseAdmin) return null;

  let query = supabaseAdmin
    .from('platform_membership_subscriptions')
    .select('status, trial_ends_at')
    .limit(2);

  query = companyId
    ? query.eq('company_id', companyId)
    : query.eq('user_id', userId).is('company_id', null);

  const { data, error } = await query;
  if (error) {
    redirect('/login?reason=service_unavailable');
  }

  const rows = (data ?? []) as SubscriptionRow[];
  if (rows.length !== 1) return null;
  return rows[0];
}

async function resolveStandaloneDriverCompanyId(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select('company_id, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(2);

  if (error) redirect('/login?reason=service_unavailable');

  const rows = (data ?? []) as Array<{ company_id?: string | null; status?: string | null }>;
  if (rows.length !== 1) return null;
  return rows[0]?.company_id ?? null;
}

export default async function MembershipEntitlementGate({
  children,
  workspacePath,
}: {
  children: ReactNode;
  workspacePath: WorkspacePath;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ROUTE_AUTH_COOKIE_NAME)?.value?.trim();

  if (!accessToken || !supabaseValidator) {
    redirect('/login');
  }
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    redirect('/login?reason=service_unavailable');
  }

  const { data: authData, error: authError } = await supabaseValidator.auth.getUser(accessToken);
  if (authError || !authData.user) {
    redirect('/login');
  }

  const userId = authData.user.id;
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status, company_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) redirect('/login?reason=service_unavailable');

  const profile = profileData as {
    role?: string | null;
    status?: string | null;
    company_id?: string | null;
  } | null;

  if (!profile || profile.status?.toLowerCase() !== 'active') {
    redirect('/forbidden');
  }

  if (profile.role?.toLowerCase() === 'owner') {
    return children;
  }

  const { data: membershipData, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, company_id, user_id, role_in_company, status, companies(id, name, company_type, status)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (membershipError) redirect('/login?reason=service_unavailable');

  const memberships = normalizeMembershipRows((membershipData ?? []) as MembershipRow[]);
  let companyId: string | null = null;

  if (memberships.length > 0) {
    const activeCompany = resolveActiveCompanyContext(memberships, {
      preferredCompanyId: profile.company_id ?? null,
      targetPathname: workspacePath,
    });

    if (!activeCompany.ok) redirect('/forbidden');
    companyId = activeCompany.context.companyId;
  } else if (workspacePath === '/driver') {
    companyId = await resolveStandaloneDriverCompanyId(userId);
    if (!companyId) return children;
  }

  const subscription = await readSubscription(companyId, userId);
  if (!subscription) {
    return billingRedirect('membership_missing');
  }

  const entitlement = resolveMembershipEntitlement({
    status: subscription.status ?? null,
    trialEndsAt: subscription.trial_ends_at ?? null,
  });

  if (!entitlement.workspaceAllowed) {
    billingRedirect(entitlement.reason);
  }

  return children;
}
