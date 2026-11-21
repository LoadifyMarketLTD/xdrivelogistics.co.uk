const fs=require('fs');const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite(); const p=require('path').resolve(__dirname,'../../supabase/migrations')+'/';
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text,name text);
CREATE TABLE public.jobs(id uuid primary key,assigned_driver_id uuid,assigned_company_id uuid,status text,current_status text,exchange_visibility text,updated_at timestamptz);
CREATE TABLE public.drivers(id uuid primary key,user_id uuid,company_id uuid,status text);
CREATE TABLE public.company_memberships(user_id uuid,company_id uuid,status text,role_in_company text);
CREATE TABLE public.job_stops(id uuid primary key default gen_random_uuid(),job_id uuid,sequence integer,stop_type text,address text,instructions text,status text,completed_at timestamptz,updated_at timestamptz,arrived_at timestamptz,handover jsonb,unique(job_id,sequence));
CREATE TABLE public.loads(job_id uuid,status text);
CREATE TABLE public.owner_audit_log(actor_user_id uuid,target_company_id uuid,action_type text,old_status text,new_status text,reason text);
CREATE TABLE public.job_tracking_events(id uuid,event_type text);
CREATE TABLE public.job_cancellation_requests(id uuid primary key,job_id uuid,status text,owner_company_id uuid,carrier_company_id uuid,requester_party text,decided_by_user_id uuid,decision_notes text,decided_at timestamptz,updated_at timestamptz);
`);
for(const name of ['20261117132500_driver_stop_execution_outcomes.sql','20261117142000_guard_cancellation_approval_until_goods_resolved.sql','20261117174000_atomic_driver_stop_cancellation.sql','20261117175000_authorised_goods_custody_resolution.sql']){try{await db.exec(fs.readFileSync(p+name,'utf8'));console.log(name,'MIGRATION_OK')}catch(e){console.error(name,'MIGRATION_FAIL',e.message);await db.exec('ROLLBACK').catch(()=>{});throw e;}}
const ids={job:'00000000-0000-4000-8000-000000000001',driver:'00000000-0000-4000-8000-000000000002',actor:'00000000-0000-4000-8000-000000000003',company:'00000000-0000-4000-8000-000000000004',first:'00000000-0000-4000-8000-000000000005',second:'00000000-0000-4000-8000-000000000006',dispatcher:'00000000-0000-4000-8000-000000000007'};
await db.query(`INSERT INTO jobs(id,assigned_driver_id,assigned_company_id,status,current_status) VALUES($1,$2,$3,'allocated','allocated')`,[ids.job,ids.driver,ids.company]);
await db.query(`INSERT INTO drivers(id,user_id,company_id,status) VALUES($1,$2,$3,'active')`,[ids.driver,ids.actor,ids.company]);
await db.query(`INSERT INTO company_memberships(user_id,company_id,status,role_in_company) VALUES($1,$2,'active','dispatcher')`,[ids.dispatcher,ids.company]);
await db.query(`INSERT INTO job_stops(id,job_id,sequence,stop_type,address,status,completed_at) VALUES($1,$3,1,'collection','Depot','completed',now()),($2,$3,2,'delivery','Customer','arrived',NULL)`,[ids.first,ids.second,ids.job]);
const driverRequested={reason:'Recipient refused goods',instructionChannel:'phone',goodsInCustody:true,goodsDisposition:'return_to_collection'};
const direct=await db.query(`SELECT public.apply_driver_stop_cancellation_atomic($1,$2,$3,'arrived',$4::jsonb,'Depot') AS result`,[ids.job,ids.second,ids.actor,JSON.stringify(driverRequested)]);
if(direct.rows[0].result.followUpStop!==null||direct.rows[0].result.resolutionRequired!==true||direct.rows[0].result.stop.status!=='arrived')throw Error('Driver bypassed dispatcher authorisation');
console.log('DRIVER_CANNOT_SELF_AUTHORISE_RETURN_OK');
const cancel={reason:'Recipient unavailable',instructionChannel:'phone',goodsInCustody:true,goodsDisposition:'await_instructions'};
const c=direct;
if(c.rows[0].result.resolutionRequired!==true)throw Error('Await custody failed');console.log('CUSTODY_PENDING_OK');
try{await db.query(`SELECT public.resolve_driver_goods_custody_atomic($1,$2,$3,'return_to_collection','Depot','Return authorised by dispatcher')`,[ids.job,ids.second,ids.actor]);throw Error('unauthorized actor accepted')}catch(e){if(e.message==='unauthorized actor accepted')throw e;console.log('UNAUTHORISED_REJECTED_OK')}
const r=await db.query(`SELECT public.resolve_driver_goods_custody_atomic($1,$2,$3,'return_to_collection','Depot','Return authorised by dispatcher') AS result`,[ids.job,ids.second,ids.dispatcher]);
const result=r.rows[0].result;if(!result.followUpStop?.id||result.stop.status!=='cancelled')throw Error('Return creation not atomic');console.log('RETURN_ATOMIC_OK',result.followUpStop.id);
try{await db.query(`SELECT public.resolve_driver_goods_custody_atomic($1,$2,$3,'return_to_collection','Depot','Duplicate authorisation')`,[ids.job,ids.second,ids.dispatcher]);throw Error('duplicate accepted')}catch(e){if(e.message==='duplicate accepted')throw e;console.log('DUPLICATE_REJECTED_OK')}
const count=await db.query('SELECT count(*)::int AS n FROM job_stops WHERE job_id=$1',[ids.job]);if(count.rows[0].n!==3)throw Error('Duplicate return stop');console.log('STOP_COUNT_OK',count.rows[0].n);
const follow=result.followUpStop.id;
const before=await db.query(`SELECT status FROM job_stops WHERE id=$1`,[follow]);if(before.rows[0].status!=='pending')throw Error('return not pending');
try{await db.query(`SELECT public.apply_driver_stop_cancellation_atomic($1,$2,$3,'pending',$4::jsonb,'Depot')`,[ids.job,follow,ids.dispatcher,JSON.stringify({...cancel,goodsDisposition:'return_to_collection'})]);throw Error('dispatcher pretended driver')}catch(e){if(e.message==='dispatcher pretended driver')throw e;console.log('DRIVER_IDENTITY_ENFORCED_OK')}
const state=await db.query(`SELECT status, handover->'returnInstruction'->>'resolutionRequired' AS pending FROM job_stops WHERE id=$1`,[ids.second]);if(state.rows[0].status!=='cancelled'||state.rows[0].pending!=='false')throw Error('source not resolved');console.log('SOURCE_CUSTODY_CLOSED_OK');
await db.query(`UPDATE jobs SET status='delivered',current_status='delivered' WHERE id=$1`,[ids.job]);
try{await db.query(`SELECT public.apply_driver_stop_cancellation_atomic($1,$2,$3,'pending',$4::jsonb,NULL)`,[ids.job,follow,ids.actor,JSON.stringify({...cancel,goodsInCustody:false,goodsDisposition:'none'})]);throw Error('delivered job accepted cancellation')}catch(e){if(e.message==='delivered job accepted cancellation')throw e;console.log('DELIVERED_JOB_REJECTED_OK')}
try{await db.query(`SELECT public.resolve_driver_goods_custody_atomic($1,$2,$3,'return_to_collection','Depot','Authorised after closure')`,[ids.job,ids.second,ids.dispatcher]);throw Error('delivered job accepted resolution')}catch(e){if(e.message==='delivered job accepted resolution')throw e;console.log('DELIVERED_RESOLUTION_REJECTED_OK')}
const request='00000000-0000-4000-8000-000000000008',owner='00000000-0000-4000-8000-000000000009',ownerActor='00000000-0000-4000-8000-000000000010';
await db.query(`UPDATE jobs SET status='allocated',current_status='allocated' WHERE id=$1`,[ids.job]);
await db.query(`INSERT INTO company_memberships(user_id,company_id,status,role_in_company) VALUES($1,$2,'active','owner')`,[ownerActor,owner]);
await db.query(`INSERT INTO job_cancellation_requests(id,job_id,status,owner_company_id,carrier_company_id,requester_party) VALUES($1,$2,'pending',$3,$4,'carrier')`,[request,ids.job,owner,ids.company]);
await db.query(`INSERT INTO loads(job_id,status) VALUES($1,'allocated')`,[ids.job]);
const mismatchedRequest='00000000-0000-4000-8000-000000000013',mismatchedCarrier='00000000-0000-4000-8000-000000000014';
await db.query(`INSERT INTO job_cancellation_requests(id,job_id,status,owner_company_id,carrier_company_id,requester_party) VALUES($1,$2,'pending',$3,$4,'carrier')`,[mismatchedRequest,ids.job,owner,mismatchedCarrier]);
try{await db.query(`SELECT public.decide_awarded_job_cancellation_atomic($1,$2,'approved','Mismatched carrier')`,[mismatchedRequest,ownerActor]);throw Error('mismatched carrier accepted')}catch(e){if(e.message==='mismatched carrier accepted')throw e;console.log('MISMATCHED_REQUEST_CARRIER_DENIED_OK')}
const spoofRequest='00000000-0000-4000-8000-000000000011',foreignCompany='00000000-0000-4000-8000-000000000012';
await db.query(`INSERT INTO job_cancellation_requests(id,job_id,status,owner_company_id,carrier_company_id,requester_party) VALUES($1,$2,'pending',$3,$4,'load_owner')`,[spoofRequest,ids.job,owner,ids.company]);
await db.query(`UPDATE drivers SET company_id=$1 WHERE id=$2`,[foreignCompany,ids.driver]);
try{await db.query(`SELECT public.decide_awarded_job_cancellation_atomic($1,$2,'rejected','Unauthorised carrier')`,[spoofRequest,ids.actor]);throw Error('foreign driver allowed to decide')}catch(e){if(e.message==='foreign driver allowed to decide')throw e;console.log('FOREIGN_CARRIER_DRIVER_DENIED_OK')}
await db.query(`UPDATE drivers SET company_id=$1 WHERE id=$2`,[ids.company,ids.driver]);
const validDriver=await db.query(`SELECT public.decide_awarded_job_cancellation_atomic($1,$2,'rejected','Assigned carrier declines') AS result`,[spoofRequest,ids.actor]);
if(validDriver.rows[0].result.status!=='rejected')throw Error('assigned driver decision failed');console.log('ASSIGNED_CARRIER_DRIVER_ALLOWED_OK');
async function decisionBlocked(label){try{await db.query(`SELECT public.decide_awarded_job_cancellation_atomic($1,$2,'approved','Confirmed')`,[request,ownerActor]);throw Error(label+' accepted')}catch(e){if(e.message===label+' accepted')throw e;console.log(label+'_REJECTED_OK')}}
await decisionBlocked('INCOMPLETE_RETURN');
await db.query(`UPDATE job_stops SET status='completed',completed_at=now() WHERE id=$1`,[follow]);
await decisionBlocked('MISSING_POD');
await db.query(`UPDATE job_stops SET handover=coalesce(handover,'{}'::jsonb)||$2::jsonb WHERE id=$1`,[follow,JSON.stringify({recipientName:'Warehouse recipient',signaturePath:'test/signature.png',photoPaths:['test/photo.png']})]);
const forged={recipientName:'Warehouse recipient',signaturePath:'other-company/forged-signature.png',photoPaths:['other-company/forged-photo.png']};
await db.query(`UPDATE job_stops SET handover=coalesce(handover,'{}'::jsonb)||$2::jsonb WHERE id=$1`,[follow,JSON.stringify(forged)]);
await decisionBlocked('CROSS_JOB_POD');
const validPrefix=`${ids.company}/${ids.job}/stops/${follow}`;
await db.query(`UPDATE job_stops SET handover=coalesce(handover,'{}'::jsonb)||$2::jsonb WHERE id=$1`,[follow,JSON.stringify({recipientName:'Warehouse recipient',signaturePath:`${validPrefix}/signature/signed.png`,photoPaths:[`${validPrefix}/photos/return.png`]})]);
await db.query(`UPDATE job_stops SET handover=coalesce(handover,'{}'::jsonb)||$2::jsonb WHERE id=$1`,[follow,JSON.stringify({photoPaths:[]})]);
await decisionBlocked('EMPTY_RETURN_PHOTOS');
await db.query(`UPDATE job_stops SET handover=coalesce(handover,'{}'::jsonb)||$2::jsonb WHERE id=$1`,[follow,JSON.stringify({photoPaths:[`${validPrefix}/photos/return.png`]})]);
await decisionBlocked('MISSING_STORAGE_OBJECTS');
await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2),($1,$3)', ['pod-photos', `${validPrefix}/signature/signed.png`, `${validPrefix}/photos/return.png`]);
await db.query('DELETE FROM storage.objects WHERE name=$1', [`${validPrefix}/photos/return.png`]);
await decisionBlocked('MISSING_RETURN_PHOTO_OBJECT');
await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)', ['pod-photos', `${validPrefix}/photos/return.png`]);
await db.query('DELETE FROM storage.objects WHERE name=$1', [`${validPrefix}/signature/signed.png`]);
await decisionBlocked('MISSING_RETURN_SIGNATURE_OBJECT');
await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)', ['pod-photos', `${validPrefix}/signature/signed.png`]);
const approved=await db.query(`SELECT public.decide_awarded_job_cancellation_atomic($1,$2,'approved','Physical return evidenced') AS result`,[request,ownerActor]);
if(approved.rows[0].result.status!=='approved')throw Error('approval missing');
const after=await db.query(`SELECT status FROM jobs WHERE id=$1`,[ids.job]);if(after.rows[0].status!=='cancelled')throw Error('job not cancelled');
console.log('EVIDENCED_RETURN_APPROVAL_OK');
await decisionBlocked('REPEATED_APPROVAL');
await db.close()})().catch(e=>{console.error('HARNESS_FAIL',e.message);process.exitCode=1})