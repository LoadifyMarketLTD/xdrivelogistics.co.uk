const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const root=process.cwd(),read=name=>fs.readFileSync(path.join(root,'supabase','migrations',name),'utf8').replace(/^\uFEFF/,'');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),C=id(3), actor=n=>id(100+n);
(async()=>{
 const db=new PGlite();
 try{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('role',current_setting('request.jwt.claim.role',true)) $$; GRANT USAGE ON SCHEMA auth TO authenticated,service_role; CREATE TABLE companies(id uuid primary key,status text, label text); CREATE TABLE profiles(user_id uuid primary key,status text); CREATE TABLE company_memberships(company_id uuid,user_id uuid,role_in_company text,status text,unique(company_id,user_id)); CREATE TABLE company_members(id uuid primary key default gen_random_uuid(),company_id uuid,user_id uuid,company_role text,member_role text,is_active boolean); CREATE TABLE company_role_capabilities(company_role text,capability_key text); CREATE TABLE member_capability_overrides(company_member_id uuid,capability_key text,is_allowed boolean); GRANT SELECT ON company_members TO authenticated; GRANT SELECT,UPDATE ON companies TO authenticated;");
 const foundation=read('20260927162500_harden_membership_role_and_driver_invite.sql');
 const match=foundation.match(/CREATE OR REPLACE FUNCTION public\.active_company_membership_role\([\s\S]*?\$function\$;/);
 if(!match)throw Error('canonical helper missing');
 await db.exec(match[0]);
 await db.exec("REVOKE ALL ON FUNCTION public.active_company_membership_role(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.active_company_membership_role(uuid,uuid) TO authenticated,service_role;");
 await db.exec(read('20260927145000_harden_company_capability_actor_state.sql'));
 await db.exec("CREATE FUNCTION public.is_company_admin_of(uid uuid,company uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id=uid AND m.company_id=company AND m.member_role='admin') $$; CREATE FUNCTION public.is_company_members_admin(p_company_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.company_members m WHERE m.user_id=auth.uid() AND m.company_id=p_company_id AND m.member_role='admin') $$; REVOKE ALL ON FUNCTION public.is_company_admin_of(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_company_admin_of(uuid,uuid) TO authenticated,service_role; REVOKE ALL ON FUNCTION public.is_company_members_admin(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.is_company_members_admin(uuid) TO service_role;");
 for(const [company,status] of [[A,'active'],[B,'active'],[C,'suspended']])await db.query("INSERT INTO companies VALUES($1,$2,'original')",[company,status]);
 const cap='company.manage_settings';
 await db.query("INSERT INTO company_role_capabilities VALUES ('owner',$1),('admin','jobs.create'),('dispatcher','jobs.track'),('viewer','loads.view_own')",[cap]);
 // Actor, canonical role, legacy role, canonical status, profile status, company, override.
 const people=[
 [1,'owner',null,'active','active',A,null],
 [2,'member','owner','active','active',A,null],
 [3,'viewer','admin','active','active',A,null],
 [4,null,'owner','active','active',A,null],
 [5,'owner','owner','suspended','active',A,null],
 [6,'owner','owner','active','suspended',A,null],
 [7,'owner','owner','active','active',C,null],
 [8,'owner','driver','active','active',A,null],
 [9,'owner','owner','active','active',A,false],
 [10,'viewer','owner','active','active',A,true],
 [11,'member','member','active','active',A,true],
 [12,'admin',null,'active','active',A,null],
 [13,'owner','owner','active',null,A,null],
 [14,'owner','owner','active','active',B,null],
 [15,'owner','owner','active','active',A,null],
 [16,'owner','driver','active','active',A,false],
 ];
 for(const [n,canonical,legacy,status,profile,company,override] of people){
 if(profile!==null)await db.query('INSERT INTO profiles VALUES($1,$2)',[actor(n),profile]);
 if(canonical)await db.query('INSERT INTO company_memberships VALUES($1,$2,$3,$4)',[company,actor(n),canonical,status]);
 if(legacy){const r=await db.query('INSERT INTO company_members(company_id,user_id,company_role,member_role,is_active) VALUES($1,$2,$3,$4,$5) RETURNING id',[company,actor(n),legacy,legacy==='owner'?'admin':legacy,n!==15]);if(override!==null)await db.query('INSERT INTO member_capability_overrides VALUES($1,$2,$3)',[r.rows[0].id,cap,override]);}
 }
 await db.exec("ALTER TABLE companies ENABLE ROW LEVEL SECURITY; CREATE POLICY read_companies ON companies FOR SELECT TO authenticated USING(true); CREATE POLICY settings_write ON companies FOR UPDATE TO authenticated USING(public.has_capability(id,'company.manage_settings')) WITH CHECK(public.has_capability(id,'company.manage_settings'));");
 const cases=[
 ['canonical owner without legacy',1,A,cap,true],['member with stale owner',2,A,cap,false],['viewer with stale admin',3,A,'jobs.create',false],['legacy-only owner',4,A,cap,false],['suspended membership',5,A,cap,false],['suspended actor',6,A,cap,false],['suspended company',7,C,cap,false],['canonical owner with old driver role',8,A,cap,true],['explicit deny retained',9,A,cap,false],['mismatched positive override rejected',10,A,cap,false],['matching explicit positive override retained',11,A,cap,true],['canonical admin jobs create',12,A,'jobs.create',true],['missing profile denied',13,A,cap,false],['foreign tenant denied',14,A,cap,false],['inactive legacy row cannot revoke canonical role',15,A,cap,true],['deny retained after role divergence',16,A,cap,false],['unknown capability',1,A,'unknown.capability',false],['missing actor',0,A,cap,false]
 ];
 const beforeCounts=await db.query("SELECT (SELECT count(*)::int FROM company_memberships) AS canonical,(SELECT count(*)::int FROM company_members) AS legacy,(SELECT count(*)::int FROM member_capability_overrides) AS overrides");
 async function session(n,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[n?actor(n):'',role]);await db.exec('SET ROLE '+role);}
 async function run(name){let pass=0;const fails=[];const check=(label,actual,expected)=>{if(actual===expected)pass++;else fails.push({label,actual,expected})};
 for(const [label,n,company,capability,expected] of cases){await session(n);const r=await db.query('SELECT public.has_capability($1,$2) AS allowed',[company,capability]);check(label,r.rows[0].allowed,expected)}
 for(const [label,n,subject,company,expected] of [['canonical admin',12,12,A,true],['canonical owner',1,1,A,true],['stale admin',3,3,A,false],['legacy-only admin',4,4,A,false],['other actor cannot be queried',2,1,A,false],['inactive admin',5,5,A,false]]){await session(n);const r=await db.query('SELECT public.is_company_admin_of($1,$2) AS allowed',[actor(subject),company]);check(label,r.rows[0].allowed,expected)}
 for(const [n,expected] of [[1,true],[4,false],[5,false]]){await session(n,'service_role');const r=await db.query('SELECT public.is_company_members_admin($1) AS allowed',[A]);check('legacy admin wrapper '+n,r.rows[0].allowed,expected)}
 for(const [n,expected] of [[1,1],[4,0],[9,0]]){await session(n);const r=await db.query("UPDATE companies SET label='synthetic test' WHERE id=$1 RETURNING id",[A]);check('RLS update actor '+n,r.rows.length,expected)}
 await db.exec('RESET ROLE');const g=await db.query("SELECT has_function_privilege('anon','public.has_capability(uuid,text)','EXECUTE') AS anon,has_function_privilege('authenticated','public.is_company_members_admin(uuid)','EXECUTE') AS legacy_auth");check('anonymous capability closed',g.rows[0].anon,false);check('legacy admin wrapper not widened',g.rows[0].legacy_auth,false);
 console.log(JSON.stringify({name,pass,total:pass+fails.length,fails}));return fails.length;
 }
 const red=await run('before');
 await db.exec(read('20261120144701_reconcile_legacy_company_authority.sql'));
 const green=await run('after');
 await db.exec('RESET ROLE');const afterCounts=await db.query("SELECT (SELECT count(*)::int FROM company_memberships) AS canonical,(SELECT count(*)::int FROM company_members) AS legacy,(SELECT count(*)::int FROM member_capability_overrides) AS overrides");
 if(JSON.stringify(beforeCounts.rows)!==JSON.stringify(afterCounts.rows))throw Error('membership rows changed');
 console.log('DATA_COUNTS_UNCHANGED='+JSON.stringify(afterCounts.rows));
 if(red===0||green!==0)process.exitCode=1;
 }finally{await db.close()}
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1});
