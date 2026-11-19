import {NextRequest,NextResponse} from 'next/server';
import {supabaseAdmin,isSupabaseAdminConfigured} from '../../../_lib/supabaseAdmin';
import {requireCompanyCapability,isCompanyCapabilityContext} from '../../_lib/requireCompanyCapability';

export async function GET(request:NextRequest){
 const companyId=request.nextUrl.searchParams.get('companyId')?.trim()??'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId))return NextResponse.json({error:'Valid company id required.'},{status:400});
 if(!isSupabaseAdminConfigured||!supabaseAdmin)return NextResponse.json({error:'Service not available.'},{status:503});
 const access=await requireCompanyCapability(request,companyId,'quotes.award');
 if(!isCompanyCapabilityContext(access))return access;
 const {data,count,error}=await supabaseAdmin.from('job_booking_offers').select('id,job_id,bid_id,buyer_company_id,status',{count:'exact'}).eq('buyer_company_id',access.companyId).eq('status','pending').limit(1000);
 if(error||!data||count!==data.length)return NextResponse.json({error:'Complete pending booking offer status could not be verified.'},{status:503});
 return NextResponse.json({offers:data},{headers:{'Cache-Control':'private, no-store'}});
}
