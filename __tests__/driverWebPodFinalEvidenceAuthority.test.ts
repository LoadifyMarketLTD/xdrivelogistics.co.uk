import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const h=vi.hoisted(()=>({job:{} as Record<string,unknown>,list:vi.fn(),rpc:vi.fn(),driver:{driverId:'driver-test',userId:'user-test',companyId:'company-test'}}));
vi.mock('../app/api/_lib/supabaseAdmin',()=>({getBearerToken:()=>null,isSupabaseAdminConfigured:true,supabaseAdmin:{
 from:(table:string)=>{let selection='';const chain={select:(s:string)=>{selection=s;return chain},eq:()=>chain,maybeSingle:async()=>({data:selection==='id, service_mode'?{id:'job-test',service_mode:'asap_direct'}:h.job,error:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:table==='job_stops'?[]:null,error:null}).then(resolve)};return chain},
 storage:{from:()=>({list:h.list})},rpc:h.rpc,
}}));
vi.mock('../app/api/_lib/platformFlags',()=>({getFeatureFlag:async()=>true}));
vi.mock('../app/api/driver/_lib/webDriverContext',()=>({requireActiveWebDriver:async()=>h.driver,isWebDriverContext:(v:unknown)=>v===h.driver}));
vi.mock('../app/api/driver/web/jobs/[id]/webStopStatus',()=>({updateWebDriverStop:vi.fn()}));
vi.mock('../app/api/driver/web/jobs/[id]/webUndoStatus',()=>({undoWebDriverStatus:vi.fn()}));
vi.mock('../app/api/driver/mobile/_lib',()=>({jobSelect:'*',mapJob:(j:unknown)=>j,insertTrackingEvent:vi.fn(),safeArray:(v:unknown)=>Array.isArray(v)?v:[],respond:(status:number,body:unknown)=>NextResponse.json(body,{status})}));
import { POST } from '../app/api/driver/web/jobs/[id]/[action]/route';
const photo='company-test/job-test/photos/a.jpg';
const stored='company-test/job-test/signature.png';
const inline='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
const request=(overrides:Record<string,unknown>={})=>POST(new NextRequest('https://example.invalid/api/driver/web/jobs/job-test/pod',{method:'POST',body:JSON.stringify({recipientName:'Synthetic receiver',deliveryStatus:'Completed Delivery',...overrides})}),{params:Promise.resolve({id:'job-test',action:'pod'})});
beforeEach(()=>{
 h.job={id:'job-test',current_status:'delivered',pod_generated:false,delivery_photos:[photo],damage_photos:[],pod_photos:[],delivery_signature_data:stored,hard_copy_pod:'no'};
 h.rpc.mockReset().mockResolvedValue({data:{id:'job-test',_alreadySubmitted:true},error:null});
 h.list.mockReset().mockImplementation(async(_folder:string,opts:{search:string})=>({data:[{name:opts.search}],error:null}));
});
describe('web final POD evidence authority',()=>{
 it('rejects typed attestation rather than finalising a false drawn signature',async()=>{h.job.delivery_signature_data={signature_method:'typed_name_attestation',evidence_path:stored};expect((await request()).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('rejects a foreign existing signature path',async()=>{h.job.delivery_signature_data='foreign/job-test/signature.png';expect((await request()).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('rejects an existing signature whose object is missing',async()=>{h.list.mockImplementation(async(_f:string,opts:{search:string})=>({data:opts.search==='signature.png'?[]:[{name:opts.search}],error:null}));expect((await request()).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('rejects a missing existing delivery photo',async()=>{h.list.mockImplementation(async(_f:string,opts:{search:string})=>({data:opts.search==='a.jpg'?[]:[{name:opts.search}],error:null}));expect((await request()).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('rejects more than ten existing delivery photographs',async()=>{h.job.delivery_photos=Array.from({length:11},(_,i)=>'company-test/job-test/photos/'+i+'.jpg');expect((await request()).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('rejects a document-only POD',async()=>{h.job.delivery_photos=[];h.job.pod_photos=['company-test/job-test/documents/a.pdf'];expect((await request()).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('rejects invalid inline signature base64',async()=>{expect((await request({signatureData:'data:image/png;base64,not-a-valid-image!'})).status).toBe(400);expect(h.rpc).not.toHaveBeenCalled()});
 it('accepts a verified existing stored signature and photo',async()=>{expect((await request()).status).toBe(200);expect(h.rpc).toHaveBeenCalledTimes(1);expect(h.list).toHaveBeenCalledTimes(2)});
 it('accepts an inline drawn PNG with persisted photo',async()=>{expect((await request({signatureData:inline})).status).toBe(200);expect(h.rpc).toHaveBeenCalledTimes(1)});
 it('does not finalise a partial delivery or overwrite a completed POD',async()=>{expect((await request({deliveryStatus:'Partial Delivery'})).status).toBe(409);expect(h.rpc).not.toHaveBeenCalled();h.job.pod_generated=true;expect((await request()).status).toBe(200);expect(h.rpc).not.toHaveBeenCalled()});
});
