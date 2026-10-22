import type { SupabaseClient } from '@supabase/supabase-js';

export type StripeSetupCompany = { companyId: string; name: string; role: string; preApproval: boolean };
type Membership = { company_id: string; role_in_company: string; status: string };
type Company = { id: string; name: string | null; status: string; created_by: string | null };
type Application = { user_id: string; company_id: string | null; account_type: string; status: string; risk_status: string };
const allowedRoles = new Set(['owner', 'admin']);
const commercialTypes = new Set(['customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver']);
const pendingStates = new Set(['draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval']);

/** Setup permission ONLY. This does not grant membership or workspace access. */
export function stripeSetupAccessMode(
  actorId: string, profileStatus: string | null, membership: Membership,
  company: Company, applications: Application[],
): 'active' | 'pre_approval' | null {
  if (!actorId || !['active', 'pending'].includes(profileStatus ?? '') || !allowedRoles.has(membership.role_in_company)) return null;
  if (membership.company_id !== company.id) return null;
  if (profileStatus === 'active' && membership.status === 'active' && company.status === 'active') return 'active';
  if (!['active', 'invited'].includes(membership.status) || company.status !== 'pending_approval' || company.created_by !== actorId) return null;
  const bound = applications.filter(app => app.user_id === actorId && app.company_id === company.id);
  if (bound.length !== 1) return null;
  const app = bound[0];
  return commercialTypes.has(app.account_type) && pendingStates.has(app.status) && app.risk_status === 'clear'
    ? 'pre_approval' : null;
}

/** Both company listing and link creation use exactly this server-owned scope. */
export async function listStripeSetupCompanies(admin: SupabaseClient, actorId: string): Promise<StripeSetupCompany[]> {
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('status').eq('user_id', actorId).maybeSingle();
  if (profileError) throw new Error('Account authority could not be verified.');
  if (!profile || !['active', 'pending'].includes(profile.status)) return [];
  const { data: rawMemberships, error: membershipError } = await admin.from('company_memberships')
    .select('company_id, role_in_company, status').eq('user_id', actorId)
    .in('role_in_company', ['owner', 'admin']).in('status', ['active', 'invited']);
  if (membershipError) throw new Error('Company membership could not be verified.');
  const memberships = (rawMemberships ?? []) as Membership[];
  const ids = [...new Set(memberships.map(m => m.company_id).filter(Boolean))];
  if (!ids.length) return [];
  const [companyResult, appResult] = await Promise.all([
    admin.from('companies').select('id, name, status, created_by').in('id', ids),
    admin.from('onboarding_applications').select('user_id, company_id, account_type, status, risk_status')
      .eq('user_id', actorId).in('company_id', ids),
  ]);
  if (companyResult.error || appResult.error) throw new Error('Onboarding company authority could not be verified.');
  const companies = (companyResult.data ?? []) as Company[];
  const applications = (appResult.data ?? []) as Application[];
  return memberships.flatMap(membership => {
    const company = companies.find(c => c.id === membership.company_id);
    if (!company) return [];
    const mode = stripeSetupAccessMode(actorId, profile.status, membership, company, applications);
    return mode ? [{ companyId: company.id, name: company.name?.trim() || 'Your company',
      role: membership.role_in_company, preApproval: mode === 'pre_approval' }] : [];
  });
}
