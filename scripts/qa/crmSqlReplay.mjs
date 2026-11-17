import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const db = new PGlite();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
console.log('XDrive CRM: ephemeral in-memory PostgreSQL replay; no network connections or hosted writes.');
const run = (sql, args=[]) => db.query(sql,args);
let passed = 0;
const check = (v,msg) => {assert.ok(v,msg);passed++;console.log('PASS '+msg);};
const reject = async(sql,args,expected,label)=>{
  let err;try{await run(sql,args);}catch(e){err=e;}
  if(!err || !String(err.message).toLowerCase().includes(expected.toLowerCase()))console.log('UNEXPECTED ERROR in '+label+': '+(err?.message??'NO ERROR'));
  check(err && String(err.message).toLowerCase().includes(expected.toLowerCase()),label);
};
try {
  await db.exec([
    'CREATE SCHEMA auth','CREATE TABLE auth.users(id uuid PRIMARY KEY)',
    'CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id), role text, status text)',
    'CREATE TABLE public.companies(id uuid PRIMARY KEY, name text, company_number text, status text)',
    'CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid, user_id uuid, title text, body text, type text, created_at timestamptz DEFAULT now())',
    'CREATE TABLE public.jobs(id uuid PRIMARY KEY,posted_by_company_id uuid,assigned_company_id uuid,is_test boolean,created_at timestamptz DEFAULT now(),status text,current_status text,completed_at timestamptz,has_delivery_evidence boolean)',
    "INSERT INTO public.jobs(id,created_at,is_test,status,current_status,completed_at,has_delivery_evidence) VALUES('99999999-9999-4999-8999-999999999999','2026-11-01',false,'completed','delivered','2026-11-02',true)",
    'CREATE ROLE anon','CREATE ROLE authenticated','CREATE ROLE service_role'
  ].join(';')+';');
  for (const name of [
    '20261116191000_b2b_crm_private_staging.sql',
    '20261116192900_crm_contact_suppression_guard.sql',
    '20261117060000_crm_workflows_isolated_staging.sql',
    '20261117072000_crm_prospect_followup_workflow.sql',
    '20261117084500_crm_privacy_support_crossref.sql',
    '20261117093823_crm_owner_alerts_20261117.sql',
    '20261117094204_crm_business_interest_intake.sql',
    '20261117094950_crm_verified_first_job_20261117.sql'
  ]) {
    try {
      await db.exec(fs.readFileSync(path.join(root,'supabase','migrations',name),'utf8'));
      console.log('MIGRATION PASS '+name);
    } catch(e) {
      console.log('MIGRATION FAIL '+name+': '+e.message);
      throw e;
    }
  }
  const actor='11111111-1111-4111-8111-111111111111';
  const company='22222222-2222-4222-8222-222222222222';
  await run('INSERT INTO auth.users(id) VALUES ($1)',[actor]);
  await run("INSERT INTO public.profiles(user_id,role,status) VALUES($1,'owner','active')",[actor]);
  await run("INSERT INTO public.companies(id,name,company_number,status) VALUES ($1,'Smoke Freight Ltd','12000001','active')",[company]);
  const o=await run("INSERT INTO public.crm_prospect_organisations(legal_name,company_number,website,website_domain,legal_form,segment,source_url,source_checked_at,created_by,last_actor_id) VALUES('Smoke Freight Ltd','12000001','https://smoke.example','smoke.example','ltd','customer','https://smoke.example/contact',now(),$1,$1) RETURNING id",[actor]);
  const org=o.rows[0].id;
  const oe=await run('SELECT count(*)::int AS n FROM public.crm_prospect_events WHERE organisation_id=$1',[org]);
  check(oe.rows[0].n===1,'organisation insertion audited');
  await reject("INSERT INTO public.crm_prospect_organisations(legal_name,company_number,website_domain,legal_form,segment,source_url,source_checked_at,created_by) VALUES('Duplicate Ltd','12000001','other.example','ltd','customer','https://other.example',now(),$1)",[actor],'duplicate key','company number duplicates blocked');
  await reject("INSERT INTO public.crm_prospect_organisations(legal_name,company_number,website_domain,legal_form,segment,source_url,source_checked_at,created_by) VALUES('Duplicate Domain Ltd','X10001','smoke.example','ltd','customer','https://other.example',now(),$1)",[actor],'duplicate key','domain duplicates blocked');
  const work=await run("SELECT public.crm_record_prospect_action($1,$2,$3,$4,$5,$6,$7,$8) AS result",
    [org,null,actor,'research_completed','other','Research independently verified from official public company page','schedule',new Date(Date.now()+86400000).toISOString()]);
  check(work.rows[0].result?.status==='researching','atomic workflow advances evidenced research stage');
  const scheduled=await run('SELECT status,next_follow_up_at FROM public.crm_prospect_organisations WHERE id=$1',[org]);
  check(scheduled.rows[0].status==='researching'&&scheduled.rows[0].next_follow_up_at,
    'research follow-up scheduled atomically with activity');
  const attempt=await run("SELECT public.crm_record_prospect_action($1,$2,$3,$4,$5,$6,$7,$8) AS result",
    [org,null,actor,'call_attempted','phone','Attempted a call, no answer and no contact established','preserve',null]);
  check(attempt.rows[0].result?.status==='researching','unsuccessful call attempt is not falsely marked contacted');
  const co=await run("INSERT INTO public.crm_prospect_contacts(organisation_id,business_email,contact_kind,lawful_basis,source_url,last_actor_id) VALUES($1,'hello@smoke.example','generic_business','undetermined','https://smoke.example/contact',$2) RETURNING id",[org,actor]);
  const cid=co.rows[0].id;
  await run("INSERT INTO public.crm_prospect_suppressions(channel,normalized_contact_value,reason,source) VALUES('email','blocked@smoke.example','opt_out','Smoke test')");
  await reject("INSERT INTO public.crm_prospect_contacts(organisation_id,business_email,contact_kind,lawful_basis,source_url,last_actor_id) VALUES($1,'blocked@smoke.example','generic_business','undetermined','https://smoke.example',$2)",[org,actor],'suppressed','suppressed contact insertion blocked');
  await reject("UPDATE public.crm_prospect_contacts SET business_email='blocked@smoke.example' WHERE id=$1",[cid],'suppressed','suppressed contact update blocked');
  const event=await run('SELECT id FROM public.crm_prospect_events WHERE organisation_id=$1 LIMIT 1',[org]);
  await reject('DELETE FROM public.crm_prospect_events WHERE id=$1',[event.rows[0].id],'append-only','audit deletion blocked');
  await reject("UPDATE public.crm_prospect_events SET note='tampered' WHERE id=$1",[event.rows[0].id],'append-only','audit update blocked');
  await run("INSERT INTO public.crm_campaign_drafts(name,segment,channel,subject,body,created_by) VALUES('Review only','customer','email','Subject','Dear business',$1)",[actor]);
  const ca=await run('SELECT count(*)::int AS n FROM public.crm_campaign_audit');
  check(ca.rows[0].n===1,'campaign insertion audited');
  await reject("UPDATE public.crm_campaign_audit SET action='tampered'",[],'append-only','campaign audit immutable');
  const pr=await run("INSERT INTO public.crm_privacy_requests(contact_id,organisation_id,request_type,request_note,created_by,requester_verified,status,legal_hold_reviewed_at) VALUES($1,$2,'erasure','Verified erasure decision',$3,true,'approved',now()) RETURNING id",[cid,org,actor]);
  const pid=pr.rows[0].id;
  const er=await run("SELECT public.crm_execute_prospect_erasure($1,$2,$3) AS result",[pid,actor,'Approved verified erasure, no legal hold and no separate retention requirement']);
  check(er.rows[0].result?.personal_record_deleted===true,'atomic erasure succeeded');
  const remaining=await run('SELECT count(*)::int AS n FROM public.crm_prospect_contacts WHERE id=$1',[cid]);
  check(remaining.rows[0].n===0,'contact deleted');
  const request=await run('SELECT status,contact_id FROM public.crm_privacy_requests WHERE id=$1',[pid]);
  check(request.rows[0].status==='fulfilled'&&request.rows[0].contact_id===null,'privacy request fulfilled and FK nulled');
  const redacted=await run("SELECT note,contact_id FROM public.crm_prospect_events WHERE organisation_id=$1 AND event_type='contact_created'",[org]);
  check(redacted.rows.length===1 && redacted.rows[0].contact_id===null &&
    redacted.rows[0].note==='[redacted after verified contact erasure]','contact-linked audit notes redacted during erasure');
  const saved=await run("SELECT count(*)::int AS n FROM public.crm_prospect_suppressions WHERE normalized_contact_value='blocked@smoke.example'");
  check(saved.rows[0].n===1,'suppression registry retained');
  const holdContact=await run("INSERT INTO public.crm_prospect_contacts(organisation_id,business_email,contact_kind,lawful_basis,source_url,last_actor_id) VALUES($1,'hold@smoke.example','generic_business','undetermined','https://smoke.example',$2) RETURNING id",[org,actor]);
  const holdId=holdContact.rows[0].id;
  const noAssessment=await run("INSERT INTO public.crm_privacy_requests(contact_id,organisation_id,request_type,request_note,created_by,requester_verified,status) VALUES($1,$2,'erasure','Hold assessment missing',$3,true,'approved') RETURNING id",[holdId,org,actor]);
  await reject("SELECT public.crm_execute_prospect_erasure($1,$2,$3)",[noAssessment.rows[0].id,actor,'Owner asks to delete without legal-hold review'],'not eligible','erasure requires a documented legal-hold review');
  const activeHold=await run("INSERT INTO public.crm_privacy_requests(contact_id,organisation_id,request_type,request_note,created_by,requester_verified,status,legal_hold,legal_hold_reviewed_at) VALUES($1,$2,'erasure','Active legal hold confirmed',$3,true,'approved',true,now()) RETURNING id",[holdId,org,actor]);
  await reject("SELECT public.crm_execute_prospect_erasure($1,$2,$3)",[activeHold.rows[0].id,actor,'Owner asks to delete despite an active legal hold'],'not eligible','active legal hold blocks erasure');
  const retained=await run('SELECT count(*)::int AS n FROM public.crm_prospect_contacts WHERE id=$1',[holdId]);
  check(retained.rows[0].n===1,'contact remains when erasure denied');
  // New Production owner reminders: duplicate-safe and never send marketing.
  await run("UPDATE public.crm_prospect_organisations SET owner_user_id=$1,next_follow_up_at=now()-interval '2 days' WHERE id=$2",[actor,org]);
  const alarm1=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(alarm1.rows[0].result?.followups_notified===1,'one due follow-up generated one internal notification');
  const alarm2=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(alarm2.rows[0].result?.followups_notified===0,'daily CRM reminder is idempotent');
  const alertCount=await run('SELECT count(*)::int AS n FROM public.notifications');
  check(alertCount.rows[0].n===1,'single notification, no duplicate or external message');

  const oldPrivacy=await run("INSERT INTO public.crm_privacy_requests(organisation_id,request_type,request_note,created_by,status,created_at) VALUES($1,'access','Owner verified access enquiry',$2,'reviewing',now()-interval '8 days') RETURNING id",[org,actor]);
  const gdpr=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(gdpr.rows[0].result?.privacy_notified===1,'seven-day privacy review receives internal owner alert');
  const gdprRepeat=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(gdprRepeat.rows[0].result?.privacy_notified===0,'privacy alert is idempotent');
  check(oldPrivacy.rows.length===1,'privacy request source remains canonical');

  const interest=await run("INSERT INTO public.crm_business_interests(business_name,business_email,contact_name,interest_kind,message,source,privacy_notice_accepted_at) VALUES('Fresh Interest Ltd','director@interest.example','Director','partnership','I would like to discuss a genuine business partnership.','contact_form',now()) RETURNING id");
  const interestId=interest.rows[0].id;
  const reviewed=await run("SELECT public.crm_triage_business_interest($1,$2,'review','The inbound company interest is authentic enough for owner review.') AS result",[interestId,actor]);
  check(reviewed.rows[0].result?.status==='reviewing','inbound business source enters owner review');
  const accepted=await run("SELECT public.crm_triage_business_interest($1,$2,'accept','Verified company register source and an actual commercial enquiry.') AS result",[interestId,actor]);
  check(accepted.rows[0].result?.status==='accepted','owner accepts only with evidence');
  await reject("SELECT public.crm_triage_business_interest($1,$2,'accept','Trying to repeat an already final decision')",[interestId,actor],'Finalized','final inbound review cannot silently replay');
  await reject("DELETE FROM public.crm_business_interest_audit",[],'immutable','business-interest review audit cannot be deleted');
  const interestEvents=await run('SELECT count(*)::int AS n FROM public.crm_business_interest_audit WHERE interest_id=$1',[interestId]);
  check(interestEvents.rows[0].n===2,'both human inbound decisions audited');

  const incoming=await run("INSERT INTO public.crm_business_interests(business_name,business_email,contact_name,interest_kind,message,source,privacy_notice_accepted_at,created_at) VALUES('New Partner','new@partner.example','Partner','commercial','New business interest needs owner review.','contact_form',now(),now()-interval '2 days') RETURNING id");
  const incomingId=incoming.rows[0].id;
  const inboxAlert=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(inboxAlert.rows[0].result?.inbound_notified===1,'new business interest triggers one owner reminder');
  const inboxAgain=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(inboxAgain.rows[0].result?.inbound_notified===0,'business inbox notification is repeat-safe');
  await run("UPDATE public.crm_business_interests SET retained_until=now()-interval '1 day' WHERE id=$1",[incomingId]);
  const retentionAlert=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(retentionAlert.rows[0].result?.retention_notified===1,'expired retention produces internal owner review reminder');
  const retentionAgain=await run('SELECT public.crm_emit_due_owner_alerts() AS result');
  check(retentionAgain.rows[0].result?.retention_notified===0,'retention reminder is idempotent');
  const hold=await run("SELECT public.crm_manage_business_interest_retention($1,$2,'legal_hold_set',$3) AS result",
    [interestId,actor,'Documented contractual interest and owner retention review requires a temporary legal hold.']);
  check(hold.rows[0].result?.action==='legal_hold_set','reviewer can document a legal hold');
  await reject("SELECT public.crm_manage_business_interest_retention($1,$2,'retention_minimise',$3)",
    [interestId,actor,'No minimisation of an accepted or legally held commercial source is permitted.'],
    'Unexpired, legally held','legal hold and accepted source block minimisation');
  const released=await run("SELECT public.crm_manage_business_interest_retention($1,$2,'legal_hold_release',$3) AS result",
    [interestId,actor,'The documented legal hold has been reviewed and is no longer necessary for this enquiry.']);
  check(released.rows[0].result?.action==='legal_hold_release','legal hold release is audited');
  const minimal=await run("SELECT public.crm_manage_business_interest_retention($1,$2,'retention_minimise',$3) AS result",
    [incomingId,actor,'Owner reviewed expiry and confirmed no contract, legal hold or downstream linked record.']);
  check(minimal.rows[0].result?.retention_state==='minimised','expired unqualified inbound can be minimised');
  const minimisedSource=await run("SELECT business_name,company_number,marketing_opt_in,retention_state,business_email FROM public.crm_business_interests WHERE id=$1",[incomingId]);
  check(minimisedSource.rows[0].business_name==='Redacted'&&minimisedSource.rows[0].company_number===null&&
    minimisedSource.rows[0].marketing_opt_in===false&&minimisedSource.rows[0].retention_state==='minimised'&&
    minimisedSource.rows[0].business_email.includes('@example.invalid'),'privacy minimisation removes the enquiry contact fields');
  await reject("SELECT public.crm_manage_business_interest_retention($1,$2,'retention_extend',$3)",
    [incomingId,actor,'An already minimised source cannot be reinstated with personal data by a later workflow.'],
    'Previously minimised','minimisation prevents silent restoration');

  const baseline=await run("SELECT count(*)::int AS n FROM public.crm_job_test_baseline_exclusions WHERE job_id='99999999-9999-4999-8999-999999999999'");
  check(baseline.rows[0].n===1,'all historical test jobs excluded without modifying jobs');
  await run("UPDATE public.crm_prospect_organisations SET converted_company_id=$1,status='converted' WHERE id=$2",[company,org]);
  await reject("SELECT public.crm_attest_first_real_job($1,'99999999-9999-4999-8999-999999999999',$2,$3,$4)",
    [org,actor,'This historical platform job was always a test despite a completed status and delivery evidence.','I_VERIFIED_THIS_IS_A_REAL_PAID_OR_CONTRACTED_JOB_NOT_TEST'],
    'Historical or flagged test jobs','historical test job never becomes real conversion');
  const genuineId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await run("INSERT INTO public.jobs(id,posted_by_company_id,is_test,created_at,status,current_status,completed_at,has_delivery_evidence) VALUES($1,$2,false,'2026-11-18','completed','delivered','2026-11-18',true)",[genuineId,company]);
  const proof=await run("SELECT public.crm_attest_first_real_job($1,$2,$3,$4,$5) AS result",
    [org,genuineId,actor,'Independent signed job and POD reviewed; contractual evidence is genuine and this work was not generated for a test.','I_VERIFIED_THIS_IS_A_REAL_PAID_OR_CONTRACTED_JOB_NOT_TEST']);
  check(!!proof.rows[0].result?.attestation_id,'genuine documented post-baseline job can be attested once');
  await reject("SELECT public.crm_attest_first_real_job($1,$2,$3,$4,$5)",
    [org,genuineId,actor,'Repeat confirmation should fail because only one verified first job is permitted per prospect.','I_VERIFIED_THIS_IS_A_REAL_PAID_OR_CONTRACTED_JOB_NOT_TEST'],
    'duplicate key','real first-job attestation cannot be duplicated');
  await reject("UPDATE public.crm_verified_first_real_jobs SET evidence='tamper'",[],'immutable','real-job evidence proof cannot be rewritten');

  const rls=await run("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname LIKE 'crm_%' AND relkind='r'");
  check(rls.rows.length===13 && rls.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity),'all 13 CRM tables RLS forced');
  const acl=await run("SELECT has_table_privilege('anon','public.crm_prospect_contacts','SELECT') a,has_table_privilege('authenticated','public.crm_prospect_contacts','SELECT') b");
  check(acl.rows[0].a===false && acl.rows[0].b===false,'anon/authenticated CRM contact SELECT denied');
  console.log('LOCAL_SMOKE_PASS '+passed+' assertions; no hosted database accessed');
} catch(e) {
  console.error('LOCAL_SMOKE_FAIL',e.message);
  process.exitCode=1;
} finally {await db.close();}
