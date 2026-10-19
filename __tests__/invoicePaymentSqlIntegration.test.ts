import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db = new PGlite();
const invoice='11111111-1111-4111-8111-111111111111', buyer='22222222-2222-4222-8222-222222222222', supplier='33333333-3333-4333-8333-333333333333', user='44444444-4444-4444-8444-444444444444';
let attempt: string;
async function sql(q: string, params: unknown[] = []) { return (await db.query(q, params)).rows as any[]; }
const call = (name: string, args: unknown[]) => sql(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`, args).then(r=>r[0].result);
function event(id: string, type='checkout.session.completed', extra: any={}) { return { id, type, account:'acct_supplier', livemode:false, data:{ object:{ id:'cs_expected', mode:'payment', payment_status:'paid', amount_total:8000, currency:'gbp',payment_intent:'pi_expected', metadata:{xdrive_attempt_id:attempt,xdrive_invoice_id:invoice,xdrive_buyer_company_id:buyer,xdrive_supplier_company_id:supplier},...extra } } }; }
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create type public.invoice_payment_status as enum('unpaid','partially_paid','paid');
 create table invoices(id uuid primary key, company_id uuid, job_id uuid, buyer_company_id uuid,supplier_company_id uuid,approved_at timestamptz,status text,document_type text,amount numeric,currency text,payment_status invoice_payment_status,paid_at timestamptz,updated_at timestamptz,client_email text,invoice_generation_idempotency_key text,delivery_error text);
 create table company_memberships(company_id uuid,user_id uuid,status text,role_in_company text);
 create table invoice_payment_history(id uuid default gen_random_uuid(),invoice_id uuid,company_id uuid,recorded_by uuid,amount numeric,currency text,paid_at timestamptz,settlement_method text,external_reference text,note text,idempotency_key text,unique(invoice_id,idempotency_key));
 create table stripe_webhook_events(stripe_event_id text primary key,event_type text,connected_account_id text,livemode boolean,processing_status text,processed_at timestamptz,error_message text);
 create table stripe_job_payments(invoice_id uuid unique,job_id uuid,buyer_company_id uuid,supplier_company_id uuid,stripe_connected_account_id text,stripe_checkout_session_id text,stripe_payment_intent_id text,amount_minor bigint,currency text,status text,paid_at timestamptz,refunded_at timestamptz,disputed_at timestamptz,last_stripe_event_id text,updated_at timestamptz);
 create function fn_calculate_invoice_payment_status(numeric,numeric) returns invoice_payment_status language sql as $$select case when $2 >= $1 then 'paid'::invoice_payment_status when $2>0 then 'partially_paid'::invoice_payment_status else 'unpaid'::invoice_payment_status end$$;`);
 await db.exec(fs.readFileSync('supabase/migrations/129_serialize_overpayment_guard.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260916222000_restore_invoice_payment_apply_function.sql','utf8'));
 await db.exec(`create trigger trg_guard_invoice_overpayment before insert on invoice_payment_history for each row execute function fn_guard_invoice_overpayment(); create trigger trg_apply_invoice_payment after insert on invoice_payment_history for each row execute function fn_apply_invoice_payment();`);
 await db.exec(fs.readFileSync('supabase/migrations/20261018083904_invoice_payment_integrity.sql','utf8'));
 await sql(`insert into invoices values($1,$2,null,$3,$2,now(),'Approved','invoice',120,'GBP','unpaid',null,now(),'finance@example.test',null,null)`,[invoice,supplier,buyer]);
 await sql(`insert into company_memberships values($1,$2,'active','owner')`,[buyer,user]);
 await sql(`insert into invoice_payment_history(invoice_id,company_id,amount,currency,idempotency_key) values($1,$2,40,'GBP','external:initial')`,[invoice,supplier]);
},30000);
afterAll(()=>db.close());
describe.sequential('real PostgreSQL payment functions (PGlite, no external payments)',()=>{
 it('rejects nonbuyer reservation',async()=>{await expect(call('prepare_invoice_stripe_attempt',[invoice,supplier,'acct_supplier',false,'/customer/invoices/'+invoice])).rejects.toThrow('authority');});
 it('reserves only remaining balance',async()=>{const a=await call('prepare_invoice_stripe_attempt',[invoice,user,'acct_supplier',false,'/customer/invoices/'+invoice]);attempt=a.id;expect(a.amount_minor).toBe(8000);});
 it('reuses same reservation',async()=>{const a=await call('prepare_invoice_stripe_attempt',[invoice,user,'acct_supplier',false,'/different']);expect(a.id).toBe(attempt);expect(a.return_path).toBe('/customer/invoices/'+invoice);});
 it('blocks simultaneous external settlement',async()=>{await expect(sql(`insert into invoice_payment_history(invoice_id,company_id,amount,currency,idempotency_key) values($1,$2,10,'GBP','external:race')`,[invoice,supplier])).rejects.toThrow('active Stripe');});
 it('blocks cancelling a reserved payment',async()=>{await expect(sql(`update invoices set status='Cancelled' where id=$1`,[invoice])).rejects.toThrow('active Stripe');});
 it('binds the canonical session',async()=>{await call('bind_invoice_stripe_session',[attempt,'cs_expected','https://checkout.example.test']);});
 it('rejects wrong signed account without ledger mutation',async()=>{const e=event('evt_wrong');e.account='acct_other';await expect(call('apply_invoice_stripe_event',[e,false])).rejects.toThrow('account mismatch');expect((await sql('select count(*)::int as n from invoice_payment_history'))[0].n).toBe(1);});
 it('rejects unrelated session',async()=>{await expect(call('apply_invoice_stripe_event',[event('evt_wrong_session',undefined,{id:'cs_other'}),false])).rejects.toThrow('binding');});
 it('rejects live/test mixing',async()=>{await expect(call('apply_invoice_stripe_event',[{...event('evt_live'),livemode:true},false])).rejects.toThrow('mode mismatch');});
 it('keeps unpaid completion processing',async()=>{await call('apply_invoice_stripe_event',[event('evt_processing',undefined,{payment_status:'unpaid'}),false]);expect((await sql('select status from invoice_stripe_attempts'))[0].status).toBe('processing');});
 it('rolls back tracking and ledger on amount error',async()=>{await expect(call('apply_invoice_stripe_event',[event('evt_bad_amount',undefined,{amount_total:12000}),false])).rejects.toThrow('amount');expect((await sql('select count(*)::int as n from stripe_job_payments'))[0].n).toBe(0);});
 it('rolls back the entire settlement when the ledger trigger rejects insertion',async()=>{
  await sql('update invoices set amount=70 where id=$1',[invoice]);
  await expect(call('apply_invoice_stripe_event',[event('evt_ledger_failure'),false])).rejects.toThrow('Overpayment');
  expect((await sql('select count(*)::int as n from stripe_job_payments'))[0].n).toBe(0);
  expect((await sql('select count(*)::int as n from invoice_payment_history'))[0].n).toBe(1);
  await sql('update invoices set amount=120 where id=$1',[invoice]);
 });
 it('settles async success atomically',async()=>{await call('apply_invoice_stripe_event',[event('evt_success','checkout.session.async_payment_succeeded'),false]);expect((await sql('select payment_status from invoices'))[0].payment_status).toBe('paid');expect((await sql('select status from stripe_job_payments'))[0].status).toBe('paid');});
 it('deduplicates same event and different event for the same money',async()=>{await call('apply_invoice_stripe_event',[event('evt_success','checkout.session.async_payment_succeeded'),false]);await call('apply_invoice_stripe_event',[event('evt_second_success'),false]);expect((await sql('select count(*)::int as n from invoice_payment_history'))[0].n).toBe(2);});
 it('does not downgrade paid for a late expiration',async()=>{await call('apply_invoice_stripe_event',[event('evt_expired','checkout.session.expired'),false]);expect((await sql('select status from invoice_stripe_attempts'))[0].status).toBe('paid');});
 it('reconciles a partial refund and ignores stale cumulative refund',async()=>{const e=event('evt_refund','charge.refunded',{id:'ch_test',amount_refunded:3000});await call('apply_invoice_stripe_event',[e,false]);expect((await sql('select payment_status from invoices'))[0].payment_status).toBe('partially_paid');await call('apply_invoice_stripe_event',[event('evt_stale_refund','charge.refunded',{id:'ch_test',amount_refunded:1000}),false]);expect((await sql('select amount_minor from invoice_stripe_reversals'))[0].amount_minor).toBe(3000);});
 it('does not reopen refunded tracking for duplicate completion',async()=>{await call('apply_invoice_stripe_event',[event('evt_completion_late'),false]);expect((await sql('select status from stripe_job_payments'))[0].status).toBe('refunded');});
 it('caps refunds and lost disputes at the captured amount',async()=>{
  await call('apply_invoice_stripe_event',[{...event('evt_lost','charge.dispute.closed',{id:'dp_test',status:'lost',amount:8000,currency:'gbp'}),created:200},false]);
  expect((await sql('select status from stripe_job_payments'))[0].status).toBe('disputed');
  expect((await sql('select payment_status from invoices'))[0].payment_status).toBe('partially_paid');
  await call('apply_invoice_stripe_event',[{...event('evt_old_dispute','charge.dispute.created',{id:'dp_test',status:'needs_response',amount:8000,currency:'gbp'}),created:100},false]);
  expect((await sql('select status from invoice_stripe_disputes'))[0].status).toBe('lost');
 });
 it('queues generated invoices durably in the same transaction',async()=>{
  const second='55555555-5555-4555-8555-555555555555';
  await sql(`insert into invoices(id,company_id,job_id,amount,status,invoice_generation_idempotency_key) values($1,$2,$1,10,'Draft','generation-test')`,[second,supplier]);
  expect((await sql('select count(*)::int as n from invoice_delivery_outbox where invoice_id=$1',[second]))[0].n).toBe(1);
 });
 it('records email bounce without downgrading it on a stale delivered event',async()=>{
  const second='55555555-5555-4555-8555-555555555555';
  await sql(`update invoice_delivery_outbox set provider_message_id='email_test',payload='{"to":["finance@example.test"]}' where invoice_id=$1`,[second]);
  await call('apply_invoice_email_event',['msg_bounced','email_test','email.bounced','2026-10-18T10:00:00Z','finance@example.test']);
  await call('apply_invoice_email_event',['msg_delivered','email_test','email.delivered','2026-10-18T09:00:00Z','finance@example.test']);
  expect((await sql('select provider_status from invoice_delivery_outbox'))[0].provider_status).toBe('email.bounced');
  await expect(call('apply_invoice_email_event',['msg_wrong','email_test','email.delivered','2026-10-18T11:00:00Z','wrong@example.test'])).rejects.toThrow('recipient mismatch');
 });
 it('denies public RPC execution',async()=>{await db.exec('set role anon');try{await expect(call('prepare_invoice_stripe_attempt',[invoice,user,'acct_supplier',false,'/'])).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}});
});
