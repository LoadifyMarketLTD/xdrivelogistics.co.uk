import { randomUUID, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxBytes = 10 * 1024 * 1024;
const mimeExtensions: Record<string,string> = { 'application/pdf':'pdf', 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
const json = (status: number, body: Record<string,unknown>) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store, max-age=0'}});
const normal = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
function magic(bytes: Buffer, mime: string) {
  if (mime === 'application/pdf') return bytes.subarray(0,5).toString() === '%PDF-';
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return mime === 'image/webp' && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
}
/** Recovery is not a commercial action. Expired documents must not block their own repair.
 * Authentication, active profile/membership and exact tenant/driver ownership still apply. */
async function context(request: NextRequest, selectedCompany?: string | null) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin || !supabaseValidator) return json(503,{error:'Vehicle recovery is temporarily unavailable.'});
  const token = getBearerToken(request);
  if (!token) return json(401,{error:'Sign in again to manage vehicle readiness.'});
  const {data:auth,error:authError} = await supabaseValidator.auth.getUser(token);
  if (authError || !auth.user) return json(401,{error:'Your session has expired.'});
  const admin = supabaseAdmin;
  const {data:profile,error:profileError} = await admin.from('profiles').select('company_id,status').eq('user_id',auth.user.id).maybeSingle();
  if (profileError) return json(503,{error:'Account access could not be verified.'});
  if (!profile || normal(profile.status) !== 'active') return json(403,{error:'Your account requires an administrator review before vehicle changes.'});
  const companyId = selectedCompany || profile.company_id;
  if (typeof companyId !== 'string' || !uuid.test(companyId)) return json(409,{error:'Select your active company workspace first.'});
  const [membershipResult,driverResult,companyResult] = await Promise.all([
    admin.from('company_memberships').select('role_in_company,status').eq('user_id',auth.user.id).eq('company_id',companyId).eq('status','active').maybeSingle(),
    admin.from('drivers').select('id,driver_type,status').eq('user_id',auth.user.id).eq('company_id',companyId).maybeSingle(),
    admin.from('companies').select('id,status').eq('id',companyId).maybeSingle(),
  ]);
  if (membershipResult.error || driverResult.error || companyResult.error) return json(503,{error:'Vehicle recovery permissions could not be verified. Please retry.'});
  if (!membershipResult.data || !driverResult.data) return json(403,{error:'An active membership and your own driver record in this company are required.'});
  if (!['active','approved'].includes(normal(companyResult.data?.status)) || ['suspended','blocked','rejected','inactive'].includes(normal(driverResult.data.status))) return json(403,{error:'The company or driver account requires an administrator review.'});
  return {admin,userId:auth.user.id,companyId,driverId:String(driverResult.data.id),canManage:['owner','admin'].includes(normal(membershipResult.data.role_in_company))};
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request,request.nextUrl.searchParams.get('companyId'));
    if (ctx instanceof NextResponse) return ctx;
    let query = ctx.admin.from('vehicles').select('id,reg_plate,type,status,assigned_driver_id').eq('company_id',ctx.companyId).order('created_at',{ascending:false}).limit(200);
    if (!ctx.canManage) query = query.eq('assigned_driver_id',ctx.driverId);
    const {data:vehicles,error} = await query;
    if (error) return json(503,{error:'Vehicle records could not be loaded.'});
    const ids = (vehicles ?? []).filter(v=>v.assigned_driver_id === ctx.driverId).map(v=>v.id);
    const docs = ids.length ? await ctx.admin.from('vehicle_documents').select('id,vehicle_id,doc_type,status,issued_date,expiry_date,rejection_reason,created_at').in('vehicle_id',ids).order('created_at',{ascending:false}).limit(200) : {data:[],error:null};
    if (docs.error) return json(503,{error:'Vehicle documents could not be loaded. Please retry.'});
    return json(200,{companyId:ctx.companyId,driverId:ctx.driverId,canManageAssignment:ctx.canManage,vehicles:vehicles??[],documents:docs.data??[]});
  } catch {return json(503,{error:'Vehicle recovery could not be loaded. Please retry.'});}
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await context(request,request.nextUrl.searchParams.get('companyId'));
    if (ctx instanceof NextResponse) return ctx;
    if (Number(request.headers.get('content-length')??0) > maxBytes + 65536) return json(413,{error:'File must be 10 MB or smaller.'});
    const form = await request.formData().catch(()=>null);
    if (!form) return json(400,{error:'Choose a document and try again.'});
    const file = form.get('file');
    const vehicleId = String(form.get('vehicleId')??'');
    const docType = String(form.get('docType')??'');
    const issued = String(form.get('issuedDate')??'');
    const expiry = String(form.get('expiryDate')??'');
    if (!uuid.test(vehicleId) || !['mot','insurance'].includes(docType)) return json(400,{error:'Select a vehicle and MOT or insurance evidence.'});
    if (!(file instanceof File) || !file.size || file.size > maxBytes) return json(413,{error:'Choose a non-empty document up to 10 MB.'});
    if (!validDate(expiry) || (issued && !validDate(issued)) || (issued && expiry < issued) || expiry < new Date().toISOString().slice(0,10)) return json(400,{error:'Supply a current expiry date and a valid issue date.'});
    const extension = mimeExtensions[file.type];
    if (!extension) return json(415,{error:'Use a PDF, JPG, PNG or WEBP file.'});
    const {data:vehicle,error} = await ctx.admin.from('vehicles').select('id').eq('id',vehicleId).eq('company_id',ctx.companyId).eq('assigned_driver_id',ctx.driverId).eq('status','active').maybeSingle();
    if (error) return json(503,{error:'Vehicle assignment could not be verified.'});
    if (!vehicle) return json(403,{error:'The document must belong to your active assigned vehicle in this company.'});
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!magic(bytes,file.type)) return json(415,{error:'The document content does not match its declared file type.'});
    const path = ctx.companyId+'/'+vehicleId+'/'+randomUUID()+'-'+docType+'.'+extension;
    const bucket = ctx.admin.storage.from('vehicle-docs');
    const uploaded = await bucket.upload(path,bytes,{contentType:file.type,upsert:false});
    if (uploaded.error) return json(503,{error:'Document upload failed. Please retry.'});
    const result = await ctx.admin.from('vehicle_documents').insert({vehicle_id:vehicleId,doc_type:docType,file_path:path,issued_date:issued||null,expiry_date:expiry,status:'pending',uploaded_by:ctx.userId,file_sha256:createHash('sha256').update(bytes).digest('hex')}).select('id,status,doc_type').single();
    if (result.error || !result.data) {
      await bucket.remove([path]);
      return json(503,{error:'The document record could not be saved. Please retry.'});
    }
    return json(201,{document:result.data,review:'pending',message:'Document submitted for verification. Commercial access remains restricted until the evidence is approved.'});
  } catch {return json(503,{error:'Document upload could not be completed. Please retry.'});}
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await context(request,request.nextUrl.searchParams.get('companyId'));
    if (ctx instanceof NextResponse) return ctx;
    if (!ctx.canManage) return json(403,{error:'Only a company owner or administrator can change vehicle assignments. You may upload evidence for your assigned vehicle.'});
    const body = await request.json().catch(()=>null) as {vehicleId?:string;action?:string}|null;
    if (!body?.vehicleId || !uuid.test(body.vehicleId) || !['assign','unassign'].includes(body.action??'')) return json(400,{error:'Select an assignment action and a valid vehicle.'});
    if (body.action === 'unassign') {
      const [jobs,bids] = await Promise.all([
        ctx.admin.from('jobs').select('id').eq('vehicle_id',body.vehicleId).not('status','in','(completed,delivered,cancelled)').limit(1),
        ctx.admin.from('job_bids').select('id').eq('quote_vehicle_id',body.vehicleId).in('status',['submitted','accepted']).limit(1),
      ]);
      if (jobs.error || bids.error) return json(503,{error:'Vehicle commitments could not be verified. No assignment was changed.'});
      if (jobs.data?.length || bids.data?.length) return json(409,{error:'This vehicle is committed to a job or active quote. Resolve that commitment before changing its assignment.'});
    }
    // A single conditional write plus the existing unique active-assignment index
    // prevents two active vehicles or stealing another driver assignment. Never bulk-unassign.
    let query = ctx.admin.from('vehicles').update({assigned_driver_id:body.action === 'assign' ? ctx.driverId : null}).eq('id',body.vehicleId).eq('company_id',ctx.companyId);
    query = body.action === 'assign' ? query.is('assigned_driver_id',null).eq('status','active') : query.eq('assigned_driver_id',ctx.driverId);
    const {data,error} = await query.select('id,assigned_driver_id').maybeSingle();
    if (error?.code === '23505') return json(409,{error:'You already have an active assigned vehicle. Review the existing assignment first; nothing was changed.'});
    if (error) return json(503,{error:'The assignment could not be saved. Refresh and try again.'});
    if (!data) return json(409,{error:'The vehicle assignment changed or is not available to you. Refresh before continuing.'});
    return json(200,{vehicle:data,message:'Vehicle assignment saved. Re-check the account requirements; no job or quote was submitted.'});
  } catch {return json(503,{error:'The assignment could not be saved. Please retry.'});}
}
