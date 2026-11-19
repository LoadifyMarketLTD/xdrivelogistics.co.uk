import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({actor:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',company:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',other:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',tables:{} as Record<string,Record<string,unknown>[]>,errors:new Set<string>(),reads:[] as string[]}));
const client=vi.hoisted(()=>({
 auth:{getUser:async()=>({data:{user:{id:state.actor}},error:null})},
 from(table:string){state.reads.push(table);const filters:((row:Record<string,unknown>)=>boolean)[]=[];
 const result=(single:boolean)=>{const rows=(state.tables[table]??[]).filter(row=>filters.every(f=>f(row)));return{data:single?rows[0]??null:rows,error:state.errors.has(table)?{message:'unavailable'}:null}};
 const chain={select:()=>chain,eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return chain},in:(k:string,v:unknown[])=>{filters.push(r=>v.includes(r[k]));return chain},limit:()=>chain,maybeSingle:async()=>result(true),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result(false)).then(resolve)};return chain;}
}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({isSupabaseAdminConfigured:true,supabaseAdmin:client,getBearerToken:(r:NextRequest)=>r.headers.get('authorization')?.replace(/^Bearer /,'')??null}));
import {GET} from '../app/api/workspace/fleet-overview/route';
const request=(company=state.company,auth=true)=>new NextRequest('http://localhost/api/workspace/fleet-overview?companyId='+company+'&includeDocuments=true',{headers:auth?{authorization:'Bearer test-token'}:{}});
beforeEach(()=>{state.errors.clear();state.reads=[];state.tables={company_memberships:[{company_id:state.company,user_id:state.actor,status:'active',role_in_company:'owner'}],vehicles:[{id:'v1',company_id:state.company},{id:'v2',company_id:state.other}],drivers:[{id:'d1',company_id:state.company},{id:'d2',company_id:state.other}],vehicle_documents:[{id:'doc1',vehicle_id:'v1'},{id:'doc2',vehicle_id:'v2'}],driver_documents:[{id:'dd1',driver_id:'d1'},{id:'dd2',driver_id:'d2'}]};});
describe('Fleet overview authorisation and data isolation',()=>{
 it('requires authentication before querying',async()=>{expect((await GET(request(state.company,false))).status).toBe(401);expect(state.reads).toEqual([])});
 it('rejects a foreign company',async()=>{expect((await GET(request(state.other))).status).toBe(403);expect(state.reads).toEqual(['company_memberships'])});
 it('returns only own fleet and scoped document metadata',async()=>{const r=await GET(request());expect(r.status).toBe(200);const b=await r.json();expect(b.vehicles.map((v:{id:string})=>v.id)).toEqual(['v1']);expect(b.drivers.map((v:{id:string})=>v.id)).toEqual(['d1']);expect(b.documents.map((v:{id:string})=>v.id)).toEqual(['doc1']);expect(b.driverDocuments.map((v:{id:string})=>v.id)).toEqual(['dd1']);expect(r.headers.get('cache-control')).toContain('no-store')});
 it('does not read restricted documents for driver membership',async()=>{state.tables.company_memberships[0].role_in_company='driver';const b=await(await GET(request())).json();expect(b.documentsRestricted).toBe(true);expect(b.documents).toEqual([]);expect(state.reads).not.toContain('vehicle_documents');expect(state.reads).not.toContain('driver_documents')});
 it('fails closed on unavailable fleet data',async()=>{state.errors.add('vehicles');expect((await GET(request())).status).toBe(503)});
 it('distinguishes unavailable document metadata from an empty register',async()=>{state.errors.add('driver_documents');const b=await(await GET(request())).json();expect(b.documentsUnavailable).toBe(true);expect(b.documents).toEqual([]);expect(b.driverDocuments).toEqual([])});
});
