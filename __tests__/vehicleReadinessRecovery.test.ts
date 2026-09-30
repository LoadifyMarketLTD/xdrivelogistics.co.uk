import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { driverReadinessBlocker, resolveReadinessContext } from '../lib/workspaceReadiness';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';
const f=vi.hoisted(()=>({userId:'22222222-2222-4222-8222-222222222222',companyId:'11111111-1111-4111-8111-111111111111',driverId:'33333333-3333-4333-8333-333333333333',vehicleId:'44444444-4444-4444-8444-444444444444',member:'owner',missingMember:false,vehicleAllowed:true,profileStatus:'active',companyStatus:'active',dbError:'',insertError:false,updateError:'',updateEmpty:false,commitments:false,calls:[] as Array<{table:string,method:string,args:unknown[]}>,upload:vi.fn(),remove:vi.fn()}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>{
 function from(table:string){
  let writing='';const filters:Record<string,unknown>={};
  const result=()=>{
   if(f.dbError===table)return {data:null,error:{message:'test failure'}};
   if(table==='profiles')return {data:{company_id:f.companyId,status:f.profileStatus},error:null};
   if(table==='company_memberships')return {data:f.missingMember||filters.company_id!==f.companyId?null:{role_in_company:f.member,status:'active'},error:null};
   if(table==='drivers')return {data:{id:f.driverId,driver_type:'owner_driver',status:'active'},error:null};
   if(table==='companies')return {data:{id:f.companyId,status:f.companyStatus},error:null};
   if(table==='vehicles')return {data:writing==='update'?(f.updateEmpty?null:{id:f.vehicleId}):filters.id?(f.vehicleAllowed&&filters.id===f.vehicleId?{id:f.vehicleId}:null):[{id:f.vehicleId,status:'active',assigned_driver_id:f.driverId}],error:f.updateError&&writing?{code:f.updateError}:null};
   if(table==='vehicle_documents')return {data:writing==='insert'?{id:'doc-id',status:'pending',doc_type:'mot'}:[],error:f.insertError?{message:'insert failed'}:null};
   if(table==='jobs'||table==='job_bids')return {data:f.commitments?[{id:'commitment'}]:[],error:null};
   return {data:null,error:null};
  };
  const chain:Record<string,unknown>={};
  for(const method of ['select','eq','is','in','not','order','limit','insert','update'])chain[method]=(...args:unknown[])=>{
   f.calls.push({table,method,args});if(method==='eq'||method==='is')filters[String(args[0])]=args[1];if(method==='insert'||method==='update')writing=method;return chain;
  };
  chain.maybeSingle=async()=>result();chain.single=async()=>result();chain.then=(ok:(value:unknown)=>unknown)=>Promise.resolve(result()).then(ok);return chain;
 }
 const client={from,auth:{getUser:async()=>({data:{user:{id:f.userId}},error:null})},storage:{from:()=>({upload:f.upload,remove:f.remove})}};
 return {isSupabaseAdminConfigured:true,supabaseAdmin:client,supabaseValidator:client,getBearerToken:(r:NextRequest)=>r.headers.get('authorization')?.replace('Bearer ','')||null};
});
import { GET, POST, PATCH } from '../app/api/driver/vehicle-readiness/route';
const request=(method='GET',body?:BodyInit,authorized=true)=>new NextRequest('http://localhost/api/driver/vehicle-readiness?companyId='+f.companyId,{method,headers:authorized?{Authorization:'Bearer test'}:{},body});
function upload(overrides:Record<string,string|undefined>={},bytes='%PDF-1.4 test',mime='application/pdf'){
 const data=new FormData();data.set('file',new File([bytes],'evidence.pdf',{type:mime}));data.set('vehicleId',f.vehicleId);data.set('docType','mot');data.set('issuedDate','2026-01-01');data.set('expiryDate','2099-01-01');for(const [k,v]of Object.entries(overrides))if(typeof v==='string')data.set(k,v);return request('POST',data);
}
beforeEach(()=>{f.member='owner';f.missingMember=false;f.vehicleAllowed=true;f.profileStatus='active';f.companyStatus='active';f.dbError='';f.insertError=false;f.updateError='';f.updateEmpty=false;f.commitments=false;f.calls=[];f.upload.mockReset().mockResolvedValue({error:null});f.remove.mockReset().mockResolvedValue({error:null});});
describe('vehicle recovery authority and evidence',()=>{
 it.each([GET,POST,PATCH])('rejects a missing session before database/storage access',async handler=>{expect((await handler(request(handler===GET?'GET':handler===POST?'POST':'PATCH',undefined,false))).status).toBe(401);expect(f.calls).toHaveLength(0);expect(f.upload).not.toHaveBeenCalled();});
 it('rejects missing membership',async()=>{f.missingMember=true;expect((await POST(upload())).status).toBe(403);expect(f.upload).not.toHaveBeenCalled();});
 it('rejects a suspended profile',async()=>{f.profileStatus='suspended';expect((await GET(request())).status).toBe(403);});
 it('rejects a suspended company',async()=>{f.companyStatus='suspended';expect((await GET(request())).status).toBe(403);});
 it('fails closed on a membership query error',async()=>{f.dbError='company_memberships';expect((await GET(request())).status).toBe(503);});
 it('limits company driver vehicle reads to their own assignment',async()=>{f.member='driver';const response=await GET(request());expect(response.status).toBe(200);expect((await response.json()).canManageAssignment).toBe(false);expect(f.calls).toContainEqual({table:'vehicles',method:'eq',args:['assigned_driver_id',f.driverId]});});
 it('lets assigned company drivers submit vehicle evidence without Stripe',async()=>{f.member='driver';const response=await POST(upload());expect(response.status).toBe(201);expect(f.calls.some(c=>c.table==='stripe_connected_accounts')).toBe(false);const inserted=f.calls.find(c=>c.table==='vehicle_documents'&&c.method==='insert')?.args[0];expect(inserted).toMatchObject({vehicle_id:f.vehicleId,status:'pending',uploaded_by:f.userId});});
 it('requires exact active, same-company assignment for document upload',async()=>{f.vehicleAllowed=false;expect((await POST(upload())).status).toBe(403);expect(f.upload).not.toHaveBeenCalled();});
 it.each([{docType:'cpc'},{expiryDate:'2020-01-01'},{expiryDate:'2099-02-30'},{vehicleId:'not-a-uuid'}])('rejects invalid recovery input %j',async overrides=>{expect((await POST(upload(overrides))).status).toBe(400);expect(f.upload).not.toHaveBeenCalled();});
 it('rejects files that are not the claimed type',async()=>{expect((await POST(upload({},'not pdf'))).status).toBe(415);expect(f.upload).not.toHaveBeenCalled();});
 it('cleans up its own new storage object if recording fails',async()=>{f.insertError=true;expect((await POST(upload())).status).toBe(503);expect(f.remove).toHaveBeenCalledTimes(1);});
 it('uses private vehicle-docs paths with no overwrite or client-supplied path',async()=>{expect((await POST(upload())).status).toBe(201);expect(f.upload).toHaveBeenCalledWith(expect.stringContaining(f.companyId+'/'+f.vehicleId+'/'),expect.any(Buffer),{contentType:'application/pdf',upsert:false});});
 it('never grants company-driver assignment authority',async()=>{f.member='driver';expect((await PATCH(request('PATCH',JSON.stringify({action:'assign',vehicleId:f.vehicleId})))).status).toBe(403);expect(f.calls.some(c=>c.method==='update')).toBe(false);});
 it('assigns only an unassigned active vehicle within the current company',async()=>{expect((await PATCH(request('PATCH',JSON.stringify({action:'assign',vehicleId:f.vehicleId})))).status).toBe(200);expect(f.calls).toContainEqual({table:'vehicles',method:'is',args:['assigned_driver_id',null]});expect(f.calls).toContainEqual({table:'vehicles',method:'eq',args:['company_id',f.companyId]});expect(f.calls).toContainEqual({table:'vehicles',method:'eq',args:['status','active']});});
 it('reports duplicate canonical assignment as a conflict',async()=>{f.updateError='23505';expect((await PATCH(request('PATCH',JSON.stringify({action:'assign',vehicleId:f.vehicleId})))).status).toBe(409);});
 it('reports a lost conditional write instead of claiming success',async()=>{f.updateEmpty=true;expect((await PATCH(request('PATCH',JSON.stringify({action:'assign',vehicleId:f.vehicleId})))).status).toBe(409);});
 it('does not unassign a vehicle with job or quote commitments',async()=>{f.commitments=true;expect((await PATCH(request('PATCH',JSON.stringify({action:'unassign',vehicleId:f.vehicleId})))).status).toBe(409);expect(f.calls.some(c=>c.method==='update')).toBe(false);});
 it('only unassigns the authenticated own-driver assignment',async()=>{expect((await PATCH(request('PATCH',JSON.stringify({action:'unassign',vehicleId:f.vehicleId})))).status).toBe(200);expect(f.calls).toContainEqual({table:'vehicles',method:'eq',args:['assigned_driver_id',f.driverId]});});
 it.each(['driver','owner_driver'] as const)('allows %s recovery without giving new commercial permissions',role=>{expect(isCapabilityAllowedForPath('/driver/vehicle-readiness','driver',{workspaceRole:role,driverId:f.driverId,accountStatus:'active',companyStatus:'active',driverStatus:'active',appAccess:true,membershipRole:role==='driver'?'driver':'owner'})).toBe(true);});
 it.each(['mot','insurance'])('targets the exact %s upload form',doc=>{const context=resolveReadinessContext({companyId:f.companyId,membershipRole:'driver',driverType:'company_driver'});expect(driverReadinessBlocker('vehicle_document_missing_or_invalid:'+doc,context).actionHref).toBe('/driver/vehicle-readiness?document='+doc+'#vehicle-document-upload');});
});
