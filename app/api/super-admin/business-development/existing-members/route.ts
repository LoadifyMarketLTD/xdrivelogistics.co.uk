import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse } from '../_lib/server';

export const dynamic='force-dynamic';

/** Registered platform members are NOT automatically XDrive paying customers.
 * Provides a read-only source for owner-verified existing relationships.
 * Does not read contacts or copy tenant business information into the CRM.
 */
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const page=Number(request.nextUrl.searchParams.get('page')??'1');
  const search=(request.nextUrl.searchParams.get('search')??'').trim();
  if(!Number.isSafeInteger(page)||page<1||page>10000||search.length>100||
     /[,()%]/.test(search))return crmResponse(400,{error:'Invalid member filter.'});
  const limit=25;
  let q=supabaseAdmin!.from('companies')
    .select('id,name,company_number,status', {count:'exact'})
    .eq('status','active');
  if(search)q=q.or('name.ilike.%'+search+'%,company_number.ilike.%'+search+'%');
  const {data,error,count}=await q.order('name',{ascending:true})
    .range((page-1)*limit,page*limit-1);
  if(error || count===null)return crmResponse(503,{error:'Company directory unavailable.'});
  return crmResponse(200,{
    members:(data??[]).map(row=>({
      id:row.id,name:row.name,company_number:row.company_number,status:row.status,
      source_reference:'Registered XDrive company '+row.id,
    })),
    total:count,page,limit,imported:0,
    notice:'Registration does not prove a commercial relationship. Do not label as an existing customer without separate evidence.',
  });
}
