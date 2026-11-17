const fs=require('fs');const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite(); const p=require('path').resolve(__dirname,'../../supabase/migrations')+'/';
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.jobs(id uuid primary key,assigned_driver_id uuid,assigned_company_id uuid,status text,current_status text);
CREATE TABLE public.drivers(id uuid primary key,user_id uuid,company_id uuid,status text);
CREATE TABLE public.company_memberships(user_id uuid,company_id uuid,status text,role_in_company text);
CREATE TABLE public.job_stops(id uuid primary key default gen_random_uuid(),job_id uuid,sequence integer,stop_type text,address text,instructions text,status text,completed_at timestamptz,updated_at timestamptz,arrived_at timestamptz,handover jsonb,unique(job_id,sequence));
CREATE TABLE public.job_tracking_events(id uuid,event_type text);
CREATE TABLE public.job_cancellation_requests(id uuid primary key,job_id uuid,status text,owner_company_id uuid,carrier_company_id uuid,requester_party text,decided_by_user_id uuid,decision_notes text,decided_at timestamptz,updated_at timestamptz);
`);
for(const name of ['20261117132500_driver_stop_execution_outcomes.sql','20261117142000_guard_cancellation_approval_until_goods_resolved.sql','20261117174000_atomic_driver_stop_cancellation.sql','20261117175000_authorised_goods_custody_resolution.sql']){try{await db.exec(fs.readFileSync(p+name,'utf8'));console.log(name,'MIGRATION_OK')}catch(e){console.log(name,'MIGRATION_FAIL',e.message);await db.exec('ROLLBACK').catch(()=>{});}}
const ids={job:'00000000-0000-4000-8000-000000000001',driver:'00000000-0000-4000-8000-000000000002',actor:'00000000-0000-4000-8000-000000000003',company:'00000000-0000-4000-8000-000000000004',first:'00000000-0000-4000-8000-000000000005',second:'00000000-0000-4000-8000-000000000006',dispatcher:'00000000-0000-4000-8000-000000000007'};
await db.query(`INSERT INTO jobs(id,assigned_driver_id,assigned_company_id,status,current_status) VALUES($1,$2,$3,'allocated','allocated')`,[ids.job,ids.driver,ids.company]);
await db.query(`INSERT INTO drivers(id,user_id,company_id,status) VALUES($1,$2,$3,'active')`,[ids.driver,ids.actor,ids.company]);
await db.query(`INSERT INTO company_memberships(user_id,company_id,status,role_in_company) VALUES($1,$2,'active','dispatcher')`,[ids.dispatcher,ids.company]);
await db.query(`INSERT INTO job_stops(id,job_id,sequence,stop_type,address,status,completed_at) VALUES($1,$3,1,'collection','Depot','completed',now()),($2,$3,2,'delivery','Customer','arrived',NULL)`,[ids.first,ids.second,ids.job]);
const cancel={reason:'Recipient unavailable',instructionChannel:'phone',goodsInCustody:true,goodsDisposition:'await_instructions'};
const c=await db.query(`SELECT public.apply_driver_stop_cancellation_atomic($1,$2,$3,'arrived',$4::jsonb,NULL) AS result`,[ids.job,ids.second,ids.actor,JSON.stringify(cancel)]);
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
await db.close()})().catch(e=>{console.error('HARNESS_FAIL',e.message);process.exitCode=1})