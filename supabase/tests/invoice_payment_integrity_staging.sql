-- Hosted PostgreSQL integration test. ONLY run on an empty disposable preview.
-- All business fixtures and asserted financial mutations are rolled back.
-- Stripe events below are test inputs: this is NOT provider or browser E2E.
BEGIN;
SET LOCAL statement_timeout = '30s';
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
CREATE TEMP TABLE invoice_audit_checks(check_name text PRIMARY KEY) ON COMMIT DROP;
DO $audit$
DECLARE
  b uuid; s uuid; u uuid := gen_random_uuid(); driver_user uuid := gen_random_uuid(); j uuid; bid uuid; agreement uuid; i uuid; d uuid; v uuid;
  attempt jsonb; attempt_id uuid; event jsonb; result jsonb; rejected boolean;
BEGIN
  IF EXISTS(SELECT 1 FROM public.companies) OR EXISTS(SELECT 1 FROM public.invoices) THEN
    RAISE EXCEPTION 'This rollback-only test requires an empty disposable preview';
  END IF;
  INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    VALUES(u,'audit-680@example.test','{}','{}'),(driver_user,'audit-680-driver@example.test','{}','{}');
  INSERT INTO companies(name,status) VALUES('PR680 rollback-only buyer','active') RETURNING id INTO b;
  INSERT INTO companies(name,status) VALUES('PR680 rollback-only supplier','active') RETURNING id INTO s;
  INSERT INTO company_memberships(company_id,user_id,status,role_in_company) VALUES(b,u,'active','admin');
  -- Temporary compliance metadata satisfies the unchanged quote guards. These
  -- fixtures do not represent approved real documents and never leave this transaction.
  INSERT INTO platform_identity_registry(user_id,company_id,identity_mode,status,verified_at)
    VALUES(driver_user,s,'company_driver','active',now());
  INSERT INTO drivers(company_id,user_id,display_name,name,full_name,status)
    VALUES(s,driver_user,'PR680 fixture','PR680 fixture','PR680 fixture','active') RETURNING id INTO d;
  INSERT INTO driver_documents(driver_id,doc_type,status) VALUES(d,'drivinglicence','approved'),(d,'insurance','approved');
  INSERT INTO vehicles(company_id,type,advertising_state) VALUES(s,'van_small','none') RETURNING id INTO v;
  INSERT INTO vehicle_documents(vehicle_id,doc_type,status) VALUES(v,'mot','approved'),(v,'insurance','approved');
  INSERT INTO jobs(company_id,status,current_status,pickup_location,delivery_location,pickup_datetime,delivery_datetime,payment_terms,pod_required,exchange_visibility)
    VALUES(b,'quoted','quoted','Audit pickup','Audit delivery',now()+interval '1 day',now()+interval '2 days','14 days',true,'exchange') RETURNING id INTO j;
  INSERT INTO job_bids(job_id,bidder_user_id,bidder_company_id,company_id,amount,currency,status)
    VALUES(j,driver_user,s,s,100,'GBP','submitted') RETURNING id INTO bid;
  INSERT INTO job_commercial_agreements(job_id,bid_id,buyer_company_id,supplier_company_id,agreed_amount,currency,payment_terms,vat_treatment)
    VALUES(j,bid,b,s,100,'GBP','14 days','not_registered') RETURNING id INTO agreement;
  INSERT INTO invoices(company_id,invoice_number,job_ref,due_date,client_name,client_email,net_amount,amount,currency,vat_treatment,status,
    job_id,commercial_agreement_id,buyer_company_id,supplier_company_id,invoice_generation_idempotency_key)
    VALUES(s,'PR680-'||j::text,'PR680',current_date+14,'PR680 rollback-only buyer','audit-680@example.test',100,100,'GBP','not_registered','draft',
      j,agreement,b,s,'pr680:'||j::text) RETURNING id INTO i;
  IF NOT EXISTS(SELECT 1 FROM invoice_delivery_outbox WHERE invoice_id=i) THEN RAISE EXCEPTION 'Outbox not created'; END IF;
  INSERT INTO invoice_audit_checks VALUES('generated invoice creates outbox with real triggers');

  rejected := false;
  BEGIN PERFORM prepare_invoice_stripe_attempt(i,u,'acct_audit',false,'/customer/invoices');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%not approved%' THEN RAISE; END IF; rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unapproved invoice accepted'; END IF;
  INSERT INTO invoice_audit_checks VALUES('unapproved invoice refused');

  -- Provider/PDF fields are synthetic prerequisites of the database test only.
  INSERT INTO invoice_documents(invoice_id,company_id,doc_type,file_url)
    VALUES(i,s,'invoice_pdf',s::text||'/'||i::text||'/audit-only.pdf');
  UPDATE invoices SET status='Approved',approved_at=now(),delivery_state='sent',delivery_provider='test-fixture',
    delivery_message_id='audit-only-message',delivery_recipient_email='audit-680@example.test' WHERE id=i;
  INSERT INTO invoice_payment_history(invoice_id,company_id,amount,currency,paid_at,settlement_method,idempotency_key)
    VALUES(i,s,20,'GBP',now(),'bank_transfer','audit-partial');
  attempt := prepare_invoice_stripe_attempt(i,u,'acct_audit',false,'/customer/invoices');
  attempt_id := (attempt->>'id')::uuid;
  IF (attempt->>'amount_minor')::bigint <> 8000 THEN RAISE EXCEPTION 'Outstanding balance incorrect'; END IF;
  IF prepare_invoice_stripe_attempt(i,u,'acct_audit',false,'/customer/invoices')->>'id' <> attempt_id::text THEN
    RAISE EXCEPTION 'Duplicate reservation created';
  END IF;
  INSERT INTO invoice_audit_checks VALUES('partial balance 80 GBP reserved once');
  rejected := false;
  BEGIN PERFORM prepare_invoice_stripe_attempt(i,gen_random_uuid(),'acct_audit',false,'/customer/invoices');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%authority required%' THEN RAISE; END IF; rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Outsider could reserve payment'; END IF;
  INSERT INTO invoice_audit_checks VALUES('outsider payment authority refused');
  rejected := false;
  BEGIN INSERT INTO invoice_payment_history(invoice_id,company_id,amount,currency,paid_at,settlement_method,idempotency_key)
    VALUES(i,s,1,'GBP',now(),'bank_transfer','audit-conflict');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%active Stripe%' THEN RAISE; END IF; rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'External payment bypassed reservation'; END IF;
  INSERT INTO invoice_audit_checks VALUES('external payment blocked by active Checkout');
  rejected := false;
  BEGIN UPDATE invoices SET status='void' WHERE id=i;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%active Stripe Checkout%' THEN RAISE; END IF; rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Cancellation bypassed reservation'; END IF;
  INSERT INTO invoice_audit_checks VALUES('cancellation blocked by active Checkout');
  PERFORM bind_invoice_stripe_session(attempt_id,'cs_audit','https://checkout.stripe.com/audit-only');
  event := jsonb_build_object('id','evt_audit_processing','type','checkout.session.completed','account','acct_audit','livemode',false,
    'data',jsonb_build_object('object',jsonb_build_object('id','cs_audit','mode','payment','payment_status','unpaid','amount_total',8000,'currency','gbp',
      'payment_intent','pi_audit','metadata',jsonb_build_object('xdrive_attempt_id',attempt_id,'xdrive_invoice_id',i,'xdrive_buyer_company_id',b,'xdrive_supplier_company_id',s))));
  PERFORM apply_invoice_stripe_event(event,false);
  IF (SELECT status FROM invoice_stripe_attempts WHERE id=attempt_id)<>'processing' THEN RAISE EXCEPTION 'Async Checkout not processing'; END IF;
  IF (SELECT count(*) FROM invoice_payment_history WHERE invoice_id=i)<>1 THEN RAISE EXCEPTION 'Unpaid completion settled'; END IF;
  INSERT INTO invoice_audit_checks VALUES('unpaid completion remains processing');

  event := jsonb_set(jsonb_set(jsonb_set(event,'{id}','"evt_audit_success"'),'{type}','"checkout.session.async_payment_succeeded"'),'{data,object,payment_status}','"paid"');
  rejected := false;
  BEGIN PERFORM apply_invoice_stripe_event(jsonb_set(event,'{account}','"acct_wrong"'),false);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%account mismatch%' THEN RAISE; END IF; rejected:=true; END;
  IF NOT rejected OR EXISTS(SELECT 1 FROM stripe_webhook_events WHERE stripe_event_id='evt_audit_success') THEN RAISE EXCEPTION 'Account mismatch did not rollback atomically'; END IF;
  INSERT INTO invoice_audit_checks VALUES('wrong account refused with complete rollback');
  PERFORM apply_invoice_stripe_event(event,false);
  IF (SELECT payment_status::text FROM invoices WHERE id=i)<>'paid' THEN RAISE EXCEPTION 'Async settlement failed'; END IF;
  IF (SELECT count(*) FROM invoice_payment_history WHERE invoice_id=i)<>2 THEN RAISE EXCEPTION 'Settlement ledger missing'; END IF;
  INSERT INTO invoice_audit_checks VALUES('async success settles outstanding balance');
  result := apply_invoice_stripe_event(event,false);
  IF NOT (result->>'duplicate')::boolean THEN RAISE EXCEPTION 'Event deduplication failed'; END IF;
  PERFORM apply_invoice_stripe_event(jsonb_set(event,'{id}','"evt_audit_other_id"'),false);
  IF (SELECT count(*) FROM invoice_payment_history WHERE invoice_id=i)<>2 THEN RAISE EXCEPTION 'Economic duplicate charged twice'; END IF;
  INSERT INTO invoice_audit_checks VALUES('same-event and same-payment deduplication');
  PERFORM apply_invoice_stripe_event(jsonb_set(jsonb_set(event,'{id}','"evt_audit_expired"'),'{type}','"checkout.session.expired"'),false);
  IF (SELECT status FROM invoice_stripe_attempts WHERE id=attempt_id)<>'paid' THEN RAISE EXCEPTION 'Late expiry downgraded settlement'; END IF;
  INSERT INTO invoice_audit_checks VALUES('late expiration preserves paid status');
  PERFORM apply_invoice_stripe_event(jsonb_build_object('id','evt_audit_refund','type','charge.refunded','account','acct_audit','livemode',false,
    'data',jsonb_build_object('object',jsonb_build_object('id','ch_audit','payment_intent','pi_audit','amount_refunded',3000,'currency','gbp'))),false);
  IF (SELECT payment_status::text FROM invoices WHERE id=i)<>'partially_paid' THEN RAISE EXCEPTION 'Refund status not reconciled'; END IF;
  PERFORM apply_invoice_stripe_event(jsonb_set(event,'{id}','"evt_audit_after_refund"'),false);
  IF (SELECT status FROM stripe_job_payments WHERE invoice_id=i)<>'refunded' THEN RAISE EXCEPTION 'Duplicate success erased refund'; END IF;
  INSERT INTO invoice_audit_checks VALUES('refund and late duplicate preserve net payment status');

  UPDATE invoice_delivery_outbox SET payload='{"to":["audit-680@example.test"]}',provider_message_id='audit-only-message' WHERE invoice_id=i;
  PERFORM apply_invoice_email_event('audit-bounce','audit-only-message','email.bounced',now(),'audit-680@example.test');
  PERFORM apply_invoice_email_event('audit-old-delivered','audit-only-message','email.delivered',now()-interval '1 minute','audit-680@example.test');
  IF (SELECT provider_status FROM invoice_delivery_outbox WHERE invoice_id=i)<>'email.bounced' THEN RAISE EXCEPTION 'Stale delivery erased bounce'; END IF;
  INSERT INTO invoice_audit_checks VALUES('bounce survives stale delivered event');
  IF has_function_privilege('anon','public.prepare_invoice_stripe_attempt(uuid,uuid,text,boolean,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.apply_invoice_stripe_event(jsonb,boolean)','EXECUTE')
    OR has_table_privilege('authenticated','public.invoice_stripe_attempts','SELECT') THEN RAISE EXCEPTION 'Privileged finance internals exposed'; END IF;
  INSERT INTO invoice_audit_checks VALUES('public roles cannot execute settlement or read attempts');
END;
$audit$;
SELECT count(*) AS passed_checks,jsonb_agg(check_name ORDER BY check_name) AS checks FROM invoice_audit_checks;
ROLLBACK;
