import type { SupabaseClient } from '@supabase/supabase-js';

const VIEW_ROLES = new Set(['owner','admin','dispatcher','member','viewer','fleet_manager']);
const DECISION_ROLES = new Set(['owner','admin','dispatcher']);

export type BuyerScopedMembership = {company_id:string;role_in_company:string|null};

/**
 * Company Driver never inherits Customer/Broker commercial visibility simply
 * because they are also a non-managerial company member. Explicit owner,
 * admin or dispatcher membership overrides this restriction.
 */
export async function getBuyerViewMemberships(
  admin: SupabaseClient,
  userId: string,
): Promise<BuyerScopedMembership[]> {
  const [membershipResult, driverResult]=await Promise.all([
    admin.from('company_memberships').select('company_id,role_in_company').eq('user_id',userId).eq('status','active'),
    admin.from('drivers').select('driver_type').eq('user_id',userId).eq('status','active'),
  ]);
  if(membershipResult.error || driverResult.error) throw new Error('Buyer visibility permissions could not be verified.');
  const isCompanyDriver=(driverResult.data??[]).some(d=>String(d.driver_type??'').toLowerCase()==='company_driver');
  return ((membershipResult.data??[]) as BuyerScopedMembership[]).filter(row=>{
    const role=String(row.role_in_company??'').toLowerCase();
    return VIEW_ROLES.has(role) && (!isCompanyDriver || DECISION_ROLES.has(role));
  });
}
