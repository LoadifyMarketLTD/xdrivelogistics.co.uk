-- PREPARED, NOT EXECUTED: automatic approval rejected committing temporary
-- schema/data between sessions. Requires explicit approval before application.
-- Disposable preview ONLY. Copies deployed financial functions and table
-- shapes into a private test schema; leaves public business rows untouched.
-- This verifies PostgreSQL multi-session locking, not provider/browser E2E.
BEGIN;
DO $setup$
DECLARE name text; definition text; proc record; trigger_row record; enum_row record;
BEGIN
  IF EXISTS(SELECT 1 FROM public.companies) OR EXISTS(SELECT 1 FROM public.invoices) THEN
    RAISE EXCEPTION 'Concurrency setup requires an empty disposable preview';
  END IF;
  CREATE SCHEMA audit_pr680_concurrency;
  REVOKE ALL ON SCHEMA audit_pr680_concurrency FROM PUBLIC,anon,authenticated;
  FOREACH name IN ARRAY ARRAY['invoices','company_memberships','invoice_payment_history','invoice_stripe_attempts',
    'invoice_stripe_reversals','invoice_stripe_disputes','stripe_webhook_events','stripe_job_payments','invoice_delivery_outbox'] LOOP
    EXECUTE format('CREATE TABLE audit_pr680_concurrency.%I (LIKE public.%I INCLUDING ALL)',name,name);
  END LOOP;
  FOR proc IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY[
      'prepare_invoice_stripe_attempt','bind_invoice_stripe_session','guard_invoice_external_payment',
      'guard_invoice_delivery_snapshot','apply_invoice_stripe_event','refresh_invoice_stripe_balance',
      'fn_calculate_invoice_payment_status','fn_apply_invoice_payment','fn_guard_invoice_overpayment','fn_normalize_invoice_payment_history']) LOOP
    definition := replace(pg_get_functiondef(proc.oid),'public.','audit_pr680_concurrency.');
    -- Keep shared enum types; copied composite table types belong to the test schema.
    FOR enum_row IN SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e' LOOP
      definition := replace(definition,'audit_pr680_concurrency.'||enum_row.typname,'public.'||enum_row.typname);
    END LOOP;
    EXECUTE definition;
    EXECUTE format('ALTER FUNCTION audit_pr680_concurrency.%I(%s) SET search_path=audit_pr680_concurrency,public,pg_temp',proc.proname,proc.args);
  END LOOP;
  FOR trigger_row IN SELECT t.oid FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid='public.invoice_payment_history'::regclass LOOP
    definition := replace(pg_get_triggerdef(trigger_row.oid),'public.','audit_pr680_concurrency.');
    -- pg_get_triggerdef can omit the function schema if public is on search_path.
    definition := replace(definition,'EXECUTE FUNCTION fn_','EXECUTE FUNCTION audit_pr680_concurrency.fn_');
    definition := replace(definition,'EXECUTE FUNCTION guard_','EXECUTE FUNCTION audit_pr680_concurrency.guard_');
    EXECUTE definition;
  END LOOP;
  CREATE TRIGGER delivery_guard BEFORE UPDATE ON audit_pr680_concurrency.invoices
    FOR EACH ROW EXECUTE FUNCTION audit_pr680_concurrency.guard_invoice_delivery_snapshot();
END;
$setup$;
CREATE TABLE audit_pr680_concurrency.results(scenario text,side text,backend integer,outcome jsonb,PRIMARY KEY(scenario,side));
INSERT INTO audit_pr680_concurrency.company_memberships(company_id,user_id,status,role_in_company)
  VALUES('68000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000003','active','admin');
INSERT INTO audit_pr680_concurrency.invoices(id,company_id,buyer_company_id,supplier_company_id,invoice_number,job_ref,due_date,client_name,
  net_amount,amount,subtotal,total,agreed_gross_amount,vat_treatment,currency,status,approved_at)
SELECT ('68000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'68000000-0000-4000-8000-000000000002',
  '68000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000002',
  'PR680-CONCURRENCY-'||n,'PR680',current_date+14,'Rollback fixture',100,100,100,100,100,'not_registered','GBP','sent',now()
FROM generate_series(101,105) n;

CREATE FUNCTION audit_pr680_concurrency.prepare(p_invoice uuid,p_scenario text,p_side text,p_hold double precision DEFAULT 0)
RETURNS void LANGUAGE plpgsql SET search_path=audit_pr680_concurrency,public,pg_temp AS $$
DECLARE outcome jsonb;
BEGIN
  BEGIN
    outcome := prepare_invoice_stripe_attempt(p_invoice,'68000000-0000-4000-8000-000000000003','acct_audit',false,'/customer/invoices');
  EXCEPTION WHEN OTHERS THEN outcome:=jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE); END;
  INSERT INTO results VALUES(p_scenario,p_side,pg_backend_pid(),outcome);
  PERFORM pg_sleep(p_hold);
END; $$;
CREATE FUNCTION audit_pr680_concurrency.external_payment(p_invoice uuid,p_side text,p_hold double precision DEFAULT 0)
RETURNS void LANGUAGE plpgsql SET search_path=audit_pr680_concurrency,public,pg_temp AS $$
DECLARE outcome jsonb;
BEGIN
  BEGIN
    INSERT INTO invoice_payment_history(invoice_id,company_id,amount,currency,paid_at,settlement_method,idempotency_key)
    VALUES(p_invoice,'68000000-0000-4000-8000-000000000002',20,'GBP',now(),'bank_transfer','concurrent-external');
    outcome:='{"accepted":true}';
  EXCEPTION WHEN OTHERS THEN outcome:=jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE); END;
  INSERT INTO results VALUES('external',p_side,pg_backend_pid(),outcome);
  PERFORM pg_sleep(p_hold);
END; $$;
CREATE FUNCTION audit_pr680_concurrency.cancel(p_invoice uuid,p_side text,p_hold double precision DEFAULT 0)
RETURNS void LANGUAGE plpgsql SET search_path=audit_pr680_concurrency,public,pg_temp AS $$
DECLARE outcome jsonb;
BEGIN
  BEGIN
    UPDATE invoices SET status='void' WHERE id=p_invoice;
    outcome:='{"cancelled":true}';
  EXCEPTION WHEN OTHERS THEN outcome:=jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE); END;
  INSERT INTO results VALUES('cancellation',p_side,pg_backend_pid(),outcome);
  PERFORM pg_sleep(p_hold);
END; $$;
CREATE FUNCTION audit_pr680_concurrency.webhook(p_invoice uuid,p_scenario text,p_side text,p_event text,p_hold double precision DEFAULT 0)
RETURNS void LANGUAGE plpgsql SET search_path=audit_pr680_concurrency,public,pg_temp AS $$
DECLARE outcome jsonb; a invoice_stripe_attempts; i invoices; event jsonb;
BEGIN
  SELECT * INTO a FROM invoice_stripe_attempts WHERE invoice_id=p_invoice;
  SELECT * INTO i FROM invoices WHERE id=p_invoice;
  event:=jsonb_build_object('id',p_event,'type','checkout.session.completed','account',a.account_id,'livemode',false,
    'data',jsonb_build_object('object',jsonb_build_object('id',a.session_id,'mode','payment','payment_status','paid',
      'amount_total',a.amount_minor,'currency',a.currency,'payment_intent','pi_'||p_invoice::text,
      'metadata',jsonb_build_object('xdrive_attempt_id',a.id,'xdrive_invoice_id',i.id,
      'xdrive_buyer_company_id',i.buyer_company_id,'xdrive_supplier_company_id',i.supplier_company_id))));
  BEGIN outcome:=apply_invoice_stripe_event(event,false);
  EXCEPTION WHEN OTHERS THEN outcome:=jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE); END;
  INSERT INTO results VALUES(p_scenario,p_side,pg_backend_pid(),outcome);
  PERFORM pg_sleep(p_hold);
END; $$;
DO $$ DECLARE i uuid; a jsonb; BEGIN
  FOR i IN SELECT id FROM audit_pr680_concurrency.invoices WHERE invoice_number IN ('PR680-CONCURRENCY-104','PR680-CONCURRENCY-105') LOOP
    a:=audit_pr680_concurrency.prepare_invoice_stripe_attempt(i,'68000000-0000-4000-8000-000000000003','acct_audit',false,'/customer/invoices');
    PERFORM audit_pr680_concurrency.bind_invoice_stripe_session((a->>'id')::uuid,'cs_'||i::text,'https://checkout.stripe.com/audit-only');
  END LOOP;
END; $$;
COMMIT;
