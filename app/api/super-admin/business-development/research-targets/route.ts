import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse } from '../_lib/server';

export const dynamic = 'force-dynamic';
// UK Standard Industrial Classification codes. Classification signals only;
// never treat a registry hit as proof of freight demand or marketing consent.
const sectors: Record<string, { sic: string; segment: string; label: string }> = {
  road_freight: {sic:'49410',segment:'carrier',label:'Road freight transport'},
  freight_support: {sic:'52290',segment:'broker',label:'Transport support and forwarding'},
  warehousing: {sic:'52103',segment:'customer',label:'Land-transport warehousing'},
  cargo_handling: {sic:'52243',segment:'customer',label:'Cargo handling for land transport'},
  wholesale_general: {sic:'46900',segment:'customer',label:'Non-specialised wholesale'},
  machinery_wholesale: {sic:'46690',segment:'customer',label:'Wholesale of other machinery and equipment'},
  intermediate_wholesale: {sic:'46760',segment:'customer',label:'Wholesale of other intermediate products'},
};
const base='https://api.company-information.service.gov.uk/advanced-search/companies';
const registry='https://find-and-update.company-information.service.gov.uk/company/';

export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const sector=request.nextUrl.searchParams.get('sector')??'warehousing';
  const page=Number(request.nextUrl.searchParams.get('page')??'1');
  if(!Object.prototype.hasOwnProperty.call(sectors,sector) ||
     !Number.isSafeInteger(page) || page<1 || page>5)
    return crmResponse(400,{error:'Select a defined UK industry and research page (1–5).'});
  const key=process.env.COMPANIES_HOUSE_API_KEY;
  if(!key)return crmResponse(503,{
    error:'Server-only Companies House API credentials not configured; research is unavailable.',
  });
  const category=sectors[sector];
  const params=new URLSearchParams({
    company_status:'active',sic_codes:category.sic,
    size:'20',start_index:String((page-1)*20),
  });
  try {
    const response=await fetch(base+'?'+params.toString(),{
      headers:{Authorization:'Basic '+Buffer.from(key+':').toString('base64'),
        Accept:'application/json'},
      cache:'no-store',signal:AbortSignal.timeout(12000),
    });
    if(response.status===404)return crmResponse(200,{
      sector,industry:category.label,page,total_registry_hits:0,candidates:[],imported:0,
      note:'No matching UK legal entities in this official register query.',
    });
    if(!response.ok)return crmResponse(response.status===429?503:502,{
      error:response.status===429?'Official registry rate limit.':'Companies House advanced search unavailable.',
    });
    const result=await response.json() as {
      hits?:string;
      items?:Array<{company_name?:string;company_number?:string;company_status?:string;
        company_type?:string;sic_codes?:string[];
        registered_office_address?:{locality?:string;country?:string}}>;
    };
    const companies=(result.items??[]).filter(item=>
      item.company_status==='active' && typeof item.company_name==='string' &&
      typeof item.company_number==='string' && /^[A-Z0-9]{2,8}$/i.test(item.company_number)
    ).slice(0,20);
    const numbers=companies.map(item=>item.company_number!.toUpperCase());
    let existing = new Set<string>();
    if(numbers.length){
      const {data,error}=await supabaseAdmin!.from('crm_prospect_organisations')
        .select('company_number').in('company_number',numbers);
      if(error)return crmResponse(503,{error:'CRM deduplication lookup unavailable; research fail closed.'});
      existing=new Set((data??[]).map(row=>String(row.company_number??'').toUpperCase()));
    }
    return crmResponse(200,{
      sector,industry:category.label,proposed_segment:category.segment,page,
      total_registry_hits:Number(result.hits??'0')||0,
      candidates:companies.map(item=>({
        company_name:item.company_name,
        company_number:item.company_number!.toUpperCase(),
        company_status:item.company_status,
        company_type:item.company_type??null,sic_codes:item.sic_codes??[],
        locality:item.registered_office_address?.locality??null,
        source_url:registry+item.company_number!,
        already_in_crm:existing.has(item.company_number!.toUpperCase()),
      })),
      imported:0,contacts_discovered:0,
      note:'Unverified research candidates only. SIC classification is not proof of a transport customer, public contact information or outreach permission.',
    });
  } catch {
    return crmResponse(502,{error:'Official industry research failed or timed out.'});
  }
}
