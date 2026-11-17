import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse } from '../_lib/server';

export const dynamic='force-dynamic';
const intakeCompanyId=()=>process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() || '';

/** Owner-only read adapter for XDrive public inbound quote requests.
 * It never creates CRM records, copies personal contacts or sends a reply.
 */
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const companyId=intakeCompanyId();
  if(!companyId)return crmResponse(503,{error:'XDrive public intake identity is not configured.'});
  const page=Number(request.nextUrl.searchParams.get('page')??'1');
  if(!Number.isSafeInteger(page)||page<1||page>10000)return crmResponse(400,{error:'Invalid page.'});
  const limit=25;
  const {data,error,count}=await supabaseAdmin!.from('quotes')
    .select('id,customer_name,status,created_at,company_id', {count:'exact'})
    .eq('company_id',companyId)
    .ilike('notes','%SOURCE: app.xdrivelogistics.co.uk%')
    .order('created_at',{ascending:false})
    .range((page-1)*limit,page*limit-1);
  if(error || count===null)return crmResponse(503,{error:'XDrive inbound quotes unavailable.'});
  return crmResponse(200,{
    enquiries:(data??[]).map(row=>({
      id:row.id,submitted_name:row.customer_name,status:row.status,
      created_at:row.created_at,source_url:'https://app.xdrivelogistics.co.uk',
      source_reference:'XDrive inbound quote '+row.id,
    })),
    total:count,page,limit,imported:0,
    notice:'Inbound service request is not marketing consent. Legal business identity must be independently verified.',
  });
}
