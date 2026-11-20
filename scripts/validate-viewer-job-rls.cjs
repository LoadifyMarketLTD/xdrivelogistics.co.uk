const fs=require('fs'),path=require('path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const snap=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/jobs-rls-before-viewer-restriction.json'),'utf8').replace(/^\uFEFF/,''));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),C=id(3),driver=id(20);
const target='jobs_update_creator_assign_any_member';
const old=snap.policies.find(p=>p.policyname===target);
if(!old||old.permissive!=='PERMISSIVE'||!old.qual.includes("'viewer'::text")||!old.with_check.includes("'viewer'::text"))throw Error('Hosted target policy does not match expected shape');
const tighten=exp=>exp.replace("ARRAY['owner'::text, 'admin'::text, 'dispatcher'::text, 'member'::text, 'viewer'::text]","ARRAY['owner'::text, 'admin'::text, 'dispatcher'::text, 'member'::text]");
const guard="public.active_company_membership_role(jobs.company_id, auth.uid()) IN ('owner','admin','dispatcher','member')";
const nextQual="("+tighten(old.qual)+") AND ("+guard+")";
const nextCheck="("+tighten(old.with_check)+") AND ("+guard+")";
const ddl="ALTER POLICY "+target+" ON public.jobs USING ("+nextQual+") WITH CHECK ("+nextCheck+");";
const qi=s=>'"'+s.replace(/"/g,'""')+'"';
(async()=>{const db=new PGlite();try{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',current_setting('request.jwt.claim.role',true)) $$; GRANT USAGE ON SCHEMA auth TO authenticated,service_role; CREATE TYPE status_enum AS ENUM ('active','suspended','pending','disabled'); CREATE TABLE companies(id uuid primary key,status status_enum); CREATE TABLE profiles(user_id uuid primary key,status status_enum,role text); CREATE TABLE company_memberships(company_id uuid,user_id uuid,role_in_company text,status text,unique(company_id,user_id)); CREATE TABLE drivers(id uuid primary key,user_id uuid,company_id uuid,app_access boolean,status status_enum); CREATE TABLE jobs(id uuid primary key,company_id uuid,created_by uuid,assigned_driver_id uuid,assigned_company_id uuid,awarded_carrier_company_id uuid,status text,exchange_posted_at timestamptz,exchange_visibility text,marker text); GRANT SELECT ON companies,profiles,company_memberships,drivers TO authenticated; GRANT SELECT,UPDATE,INSERT,DELETE ON jobs TO authenticated;");
 for(const f of snap.functions) await db.exec(f.definition);
 for(const p of snap.policies){const roles=p.roles.slice(1,-1).split(',').map(r=>r==='public'?'PUBLIC':qi(r)).join(',');await db.exec("CREATE POLICY "+qi(p.policyname)+" ON public.jobs AS "+p.permissive+" FOR "+p.cmd+" TO "+roles+(p.qual?" USING ("+p.qual+")":"")+(p.with_check?" WITH CHECK ("+p.with_check+")":"")+";");}
 await db.exec("ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;");
 for(const [c,s] of [[A,'active'],[B,'active'],[C,'suspended']])await db.query('INSERT INTO companies VALUES($1,$2)',[c,s]);
 const cases=[
 ['owner creator','owner','company_admin','active','active',A,A,null,false,true,true],
 ['admin creator','admin','company_admin','active','active',A,A,null,false,true,true],
 ['dispatcher creator','dispatcher','company_staff','active','active',A,A,null,false,true,true],
 ['historical member creator','member','broker','active','active',A,A,null,false,true,true],
 ['viewer creator','viewer','company_staff','active','active',A,A,null,false,true,false],
 ['viewer other company','viewer','company_staff','active','active',B,A,null,false,false,false],
 ['finance creator','finance','company_staff','active','active',A,A,null,false,false,false],
 ['compliance creator','compliance','company_staff','active','active',A,A,null,false,false,false],
 ['suspended profile creator','member','broker','suspended','active',A,A,null,false,false,false],
 ['disabled membership creator','viewer','company_staff','active','disabled',A,A,null,false,false,false],
 ['suspended tenant creator','viewer','company_staff','active','active',C,C,null,false,false,false],
 ['assigned driver own job','member','driver','active','active',A,A,null,true,true,true],
 ['assigned driver awarded to carrier','member','driver','active','active',A,B,A,true,false,false],
 ['owner creator awarded own company','owner','company_admin','active','active',A,A,A,false,true,true],
 ['viewer creator awarded own company','viewer','company_staff','active','active',A,A,A,false,false,false],
 ['foreign admin','admin','company_admin','active','active',B,A,null,false,false,false],
 ];
 await db.query("INSERT INTO drivers VALUES($1,$2,$3,true,'active')",[driver,id(900),A]);
 for(let i=0;i<cases.length;i++){
 const [label,role,profile,profileStatus,memberStatus,memberCo,jobCo,awarded,assigned]=cases[i];
 const u=id(100+i),j=id(200+i),assignedId=assigned?id(300+i):driver;
 await db.query('INSERT INTO profiles VALUES($1,$2,$3)',[u,profileStatus,profile]);
 await db.query('INSERT INTO company_memberships VALUES($1,$2,$3,$4)',[memberCo,u,role,memberStatus]);
 if(assigned)await db.query("INSERT INTO drivers VALUES($1,$2,$3,true,'active')",[assignedId,u,memberCo]);
 await db.query("INSERT INTO jobs VALUES($1,$2,$3,$4,$5,$6,'accepted',null,null,'before')",[j,jobCo,u,assignedId,assigned?memberCo:null,awarded]);
 }
 async function run(stage,expectedIndex){const results=[];for(let i=0;i<cases.length;i++){
 await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id(100+i)]);await db.exec('SET ROLE authenticated');
 let visible=false,updated=false,errorCode=null;try{
 visible=(await db.query('SELECT id FROM jobs WHERE id=$1',[id(200+i)])).rows.length===1;
 updated=(await db.query("UPDATE jobs SET marker=$2 WHERE id=$1 RETURNING id",[id(200+i),stage])).rows.length===1;
 }catch(e){if(e.code!=='42501')throw e;errorCode=e.code}
 results.push({case:cases[i][0],visible,updated,expected:cases[i][expectedIndex],pass:updated===cases[i][expectedIndex],errorCode});
 }await db.exec('RESET ROLE');console.log(JSON.stringify({stage,pass:results.filter(x=>x.pass).length,total:results.length,results}));return results}
 const before=await run('before',9);if(before.some(x=>!x.pass))throw Error('Baseline differs from expected; no migration');
 const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261120175913_restrict_viewer_creator_job_updates.sql'),'utf8');if(!migration.includes(ddl))throw Error('Untested migration predicate');await db.exec(migration);
 const after=await run('after',10);if(after.some(x=>!x.pass))throw Error('Targeted policy test failed');
 if(before.some((x,i)=>x.visible!==after[i].visible))throw Error('Read authority changed');
 console.log('SQL_FIXTURE_PASS; no hosted mutations');
 }finally{await db.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
