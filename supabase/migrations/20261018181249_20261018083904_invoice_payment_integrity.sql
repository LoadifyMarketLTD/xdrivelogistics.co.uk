BEGIN;
CREATE TABLE public.invoice_stripe_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.invoices(id),
 account_id text NOT NULL,
 livemode boolean NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor > 0),
 currency text NOT NULL CHECK(currency IN ('gbp','eur','usd')),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','open','processing','paid','expired','failed')),
 session_id text UNIQUE,
 payment_intent_id text UNIQUE,
 checkout_url text,
 return_path text NOT NULL,
 customer_email text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invoice_stripe_attempt_active ON public.invoice_stripe_attempts(invoice_id) WHERE status IN ('reserved','open','processing');
ALTER TABLE public.invoice_stripe_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_stripe_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.invoice_stripe_attempts TO service_role;

CREATE TABLE public.invoice_stripe_reversals (
 attempt_id uuid NOT NULL REFERENCES public.invoice_stripe_attempts(id),
 charge_id text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(attempt_id,charge_id)
);
ALTER TABLE public.invoice_stripe_reversals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_stripe_reversals FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.invoice_stripe_reversals TO service_role;

CREATE TABLE public.invoice_stripe_disputes (
 dispute_id text PRIMARY KEY,
 attempt_id uuid NOT NULL REFERENCES public.invoice_stripe_attempts(id),
 amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
 status text NOT NULL,
 event_created bigint NOT NULL
);
ALTER TABLE public.invoice_stripe_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_stripe_disputes FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.invoice_stripe_disputes TO service_role;
CREATE FUNCTION public.refresh_invoice_stripe_balance(p_invoice uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE face numeric; paid numeric; reversed numeric;
BEGIN
 SELECT amount INTO face FROM public.invoices WHERE id=p_invoice FOR UPDATE;
 SELECT coalesce(sum(amount),0) INTO paid FROM public.invoice_payment_history WHERE invoice_id=p_invoice;
 SELECT coalesce(sum(least(a.amount_minor,(
  coalesce((SELECT sum(r.amount_minor) FROM public.invoice_stripe_reversals r WHERE r.attempt_id=a.id),0)+
  coalesce((SELECT sum(d.amount_minor) FROM public.invoice_stripe_disputes d WHERE d.attempt_id=a.id AND d.status='lost'),0)
 ))),0)/100.0 INTO reversed FROM public.invoice_stripe_attempts a WHERE a.invoice_id=p_invoice;
 UPDATE public.invoices SET payment_status=public.fn_calculate_invoice_payment_status(face,greatest(0,paid-reversed)),paid_at=CASE WHEN paid-reversed>=face THEN paid_at ELSE NULL END WHERE id=p_invoice;
END; $$;
REVOKE ALL ON FUNCTION public.refresh_invoice_stripe_balance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_invoice_stripe_balance(uuid) TO service_role;

CREATE FUNCTION public.prepare_invoice_stripe_attempt(p_invoice uuid,p_user uuid,p_account text,p_live boolean,p_return_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE i public.invoices; a public.invoice_stripe_attempts; balance numeric;
BEGIN
 SELECT * INTO i FROM public.invoices WHERE id=p_invoice FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.company_memberships WHERE company_id=i.buyer_company_id AND user_id=p_user AND status='active' AND role_in_company IN ('owner','admin','finance')) THEN RAISE EXCEPTION 'Buyer payments authority required'; END IF;
 IF i.approved_at IS NULL OR lower(i.status::text) NOT IN ('approved','submitted','sent','overdue') OR coalesce(i.document_type,'invoice')='credit_note' THEN RAISE EXCEPTION 'Invoice is not approved and payable'; END IF;
 IF lower(coalesce(i.currency,'GBP')) NOT IN ('gbp','eur','usd') THEN RAISE EXCEPTION 'Unsupported invoice currency'; END IF;
 SELECT * INTO a FROM public.invoice_stripe_attempts WHERE invoice_id=i.id AND status IN ('reserved','open','processing') FOR UPDATE;
 IF FOUND THEN
   IF a.account_id<>p_account OR a.livemode<>p_live THEN RAISE EXCEPTION 'Existing payment attempt requires reconciliation'; END IF;
   IF a.status='reserved' AND a.created_at < now()-interval '23 hours' THEN RAISE EXCEPTION 'Unknown Stripe outcome requires reconciliation before another attempt'; END IF;
   RETURN to_jsonb(a);
 END IF;
 -- Do not re-charge a refunded invoice without an explicit replacement agreement.
 IF EXISTS(SELECT 1 FROM public.invoice_stripe_attempts WHERE invoice_id=i.id AND status='paid') THEN RAISE EXCEPTION 'Settled Stripe payment requires finance review'; END IF;
 SELECT i.amount-coalesce(sum(amount),0) INTO balance FROM public.invoice_payment_history WHERE invoice_id=i.id;
 IF balance<=0 OR lower(coalesce(i.payment_status::text,''))='paid' THEN RAISE EXCEPTION 'Invoice already paid'; END IF;
 INSERT INTO public.invoice_stripe_attempts(invoice_id,account_id,livemode,amount_minor,currency,return_path,customer_email)
 VALUES(i.id,p_account,p_live,round(balance*100),lower(coalesce(i.currency,'GBP')),p_return_path,i.client_email) RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $$;

CREATE FUNCTION public.bind_invoice_stripe_session(p_attempt uuid,p_session text,p_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE a public.invoice_stripe_attempts;
BEGIN
 SELECT * INTO a FROM public.invoice_stripe_attempts WHERE id=p_attempt FOR UPDATE;
 IF NOT FOUND OR (a.session_id IS NOT NULL AND a.session_id<>p_session) THEN RAISE EXCEPTION 'Checkout attempt mismatch'; END IF;
 UPDATE public.invoice_stripe_attempts SET session_id=p_session,checkout_url=p_url,
 status=CASE WHEN status='reserved' THEN 'open' ELSE status END,updated_at=now() WHERE id=a.id RETURNING * INTO a;
 RETURN to_jsonb(a);
END; $$;

-- Existing ledger trigger still serializes the balance and applies payment_status.
CREATE FUNCTION public.guard_invoice_external_payment() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE i public.invoices;
BEGIN
 SELECT * INTO i FROM public.invoices WHERE id=NEW.invoice_id FOR UPDATE;
 IF upper(NEW.currency)<>upper(coalesce(i.currency,'GBP')) THEN RAISE EXCEPTION 'Payment currency differs from invoice' USING ERRCODE='23514'; END IF;
 IF NEW.idempotency_key LIKE 'stripe:%' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.invoice_stripe_attempts a WHERE a.invoice_id=i.id AND (EXISTS(SELECT 1 FROM public.invoice_stripe_reversals r WHERE r.attempt_id=a.id) OR EXISTS(SELECT 1 FROM public.invoice_stripe_disputes d WHERE d.attempt_id=a.id))) THEN RAISE EXCEPTION 'Refunded or disputed invoice requires finance reconciliation' USING ERRCODE='23514'; END IF;
 IF (i.buyer_company_id IS NOT NULL AND i.approved_at IS NULL) OR lower(i.status::text) NOT IN ('approved','submitted','sent','overdue') THEN RAISE EXCEPTION 'Invoice approval required before external payment' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.invoice_stripe_attempts WHERE invoice_id=i.id AND status IN ('reserved','open','processing')) THEN RAISE EXCEPTION 'An active Stripe payment must be reconciled before external payment' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_invoice_external_payment BEFORE INSERT ON public.invoice_payment_history FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_external_payment();

CREATE FUNCTION public.apply_invoice_stripe_event(p_event jsonb,p_expected_live boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE o jsonb:=p_event#>'{data,object}'; typ text:=p_event->>'type'; a public.invoice_stripe_attempts; i public.invoices;
 account text:=p_event->>'account'; aid uuid; pi text; prior text; paid numeric; reversed numeric;
BEGIN
 IF (p_event->>'livemode')::boolean IS DISTINCT FROM p_expected_live THEN RAISE EXCEPTION 'Stripe mode mismatch'; END IF;
 INSERT INTO public.stripe_webhook_events(stripe_event_id,event_type,connected_account_id,livemode,processing_status)
 VALUES(p_event->>'id',typ,account,p_expected_live,'processing') ON CONFLICT DO NOTHING;
 SELECT processing_status INTO prior FROM public.stripe_webhook_events WHERE stripe_event_id=p_event->>'id' FOR UPDATE;
 IF prior IN ('processed','ignored') THEN RETURN jsonb_build_object('duplicate',true); END IF;
 IF typ LIKE 'checkout.session.%' THEN
   aid:=nullif(o#>>'{metadata,xdrive_attempt_id}','')::uuid;
   SELECT * INTO a FROM public.invoice_stripe_attempts WHERE id=aid;
 ELSIF typ LIKE 'payment_intent.%' THEN
   aid:=nullif(o#>>'{metadata,xdrive_attempt_id}','')::uuid;
   SELECT * INTO a FROM public.invoice_stripe_attempts WHERE id=aid;
 ELSE
   pi:=CASE WHEN typ LIKE 'payment_intent.%' THEN o->>'id' ELSE o->>'payment_intent' END;
   SELECT * INTO a FROM public.invoice_stripe_attempts WHERE payment_intent_id=pi;
 END IF;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Stripe attempt missing; reconciliation required'; END IF;
 SELECT * INTO i FROM public.invoices WHERE id=a.invoice_id FOR UPDATE;
 SELECT * INTO a FROM public.invoice_stripe_attempts WHERE id=a.id FOR UPDATE;
 IF a.livemode IS DISTINCT FROM p_expected_live OR coalesce(account,a.account_id)<>a.account_id THEN RAISE EXCEPTION 'Stripe account mismatch'; END IF;
 -- Platform events have no account property; only allow the platform account's attempt.
 IF account IS NULL THEN
   -- Caller verifies the platform account against Stripe /account before entering this function.
   IF coalesce(p_event->>'xdrive_verified_platform_account','')<>a.account_id THEN RAISE EXCEPTION 'Missing connected account'; END IF;
 END IF;
 IF typ LIKE 'checkout.session.%' THEN
   IF o#>>'{metadata,xdrive_invoice_id}' IS DISTINCT FROM i.id::text OR o#>>'{metadata,xdrive_buyer_company_id}' IS DISTINCT FROM i.buyer_company_id::text
    OR o#>>'{metadata,xdrive_supplier_company_id}' IS DISTINCT FROM i.supplier_company_id::text OR o->>'mode' IS DISTINCT FROM 'payment'
    OR a.session_id IS DISTINCT FROM o->>'id' THEN RAISE EXCEPTION 'Stripe session binding mismatch'; END IF;
 END IF;
 IF typ IN ('checkout.session.completed','checkout.session.async_payment_succeeded') THEN
   IF o->>'payment_status'='paid' THEN
     IF (o->>'amount_total')::bigint IS DISTINCT FROM a.amount_minor OR lower(o->>'currency') IS DISTINCT FROM a.currency THEN RAISE EXCEPTION 'Stripe amount or currency mismatch'; END IF;
     pi:=o->>'payment_intent';
     IF pi IS NULL THEN RAISE EXCEPTION 'Stripe payment intent missing'; END IF;
     IF a.status='paid' THEN
       IF a.payment_intent_id IS DISTINCT FROM pi THEN RAISE EXCEPTION 'Settled payment identity changed'; END IF;
       UPDATE public.stripe_webhook_events SET processing_status='processed',processed_at=now() WHERE stripe_event_id=p_event->>'id';
       RETURN jsonb_build_object('received',true,'duplicate_payment',true);
     END IF;
     -- Deduplicate economically BEFORE invoking BEFORE INSERT overpayment guards.
     IF NOT EXISTS(SELECT 1 FROM public.invoice_payment_history WHERE invoice_id=i.id AND idempotency_key='stripe:'||a.account_id||':'||pi) THEN
       INSERT INTO public.invoice_payment_history(invoice_id,company_id,recorded_by,amount,currency,paid_at,settlement_method,external_reference,note,idempotency_key)
       VALUES(i.id,i.company_id,NULL,a.amount_minor/100.0,upper(a.currency),now(),'card',pi,'Verified Stripe direct charge; supplier receives funds.','stripe:'||a.account_id||':'||pi);
     END IF;
     UPDATE public.invoice_stripe_attempts SET status='paid',payment_intent_id=pi,updated_at=now() WHERE id=a.id;
     INSERT INTO public.stripe_job_payments(invoice_id,job_id,buyer_company_id,supplier_company_id,stripe_connected_account_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_minor,currency,status,paid_at,last_stripe_event_id)
     VALUES(i.id,i.job_id,i.buyer_company_id,i.supplier_company_id,a.account_id,a.session_id,pi,a.amount_minor,a.currency,'paid',now(),p_event->>'id')
     ON CONFLICT(invoice_id) DO UPDATE SET status='paid',stripe_checkout_session_id=excluded.stripe_checkout_session_id,stripe_payment_intent_id=excluded.stripe_payment_intent_id,amount_minor=excluded.amount_minor,paid_at=excluded.paid_at,last_stripe_event_id=excluded.last_stripe_event_id,updated_at=now();
   ELSIF a.status NOT IN ('paid','expired','failed') THEN
     UPDATE public.invoice_stripe_attempts SET status='processing',updated_at=now() WHERE id=a.id;
   END IF;
 ELSIF typ IN ('checkout.session.expired','checkout.session.async_payment_failed') THEN
   IF a.status<>'paid' THEN UPDATE public.invoice_stripe_attempts SET status=CASE WHEN typ='checkout.session.expired' THEN 'expired' ELSE 'failed' END,updated_at=now() WHERE id=a.id; END IF;
 ELSIF typ='payment_intent.payment_failed' THEN
   -- A failed card attempt can still be retried in the same open Checkout. Keep reservation.
   NULL;
 ELSIF typ='charge.refunded' THEN
   IF lower(o->>'currency') IS DISTINCT FROM a.currency OR (o->>'amount_refunded')::bigint NOT BETWEEN 0 AND a.amount_minor THEN RAISE EXCEPTION 'Invalid refund'; END IF;
   INSERT INTO public.invoice_stripe_reversals(attempt_id,charge_id,amount_minor) VALUES(a.id,o->>'id',(o->>'amount_refunded')::bigint)
   ON CONFLICT(attempt_id,charge_id) DO UPDATE SET amount_minor=greatest(invoice_stripe_reversals.amount_minor,excluded.amount_minor),updated_at=now();
   PERFORM public.refresh_invoice_stripe_balance(i.id);
   UPDATE public.stripe_job_payments SET status=CASE WHEN EXISTS(SELECT 1 FROM public.invoice_stripe_disputes WHERE attempt_id=a.id AND status<>'won') THEN 'disputed' ELSE 'refunded' END,refunded_at=now(),last_stripe_event_id=p_event->>'id',updated_at=now() WHERE invoice_id=i.id;
 ELSIF typ IN ('charge.dispute.created','charge.dispute.closed') THEN
   IF lower(o->>'currency') IS DISTINCT FROM a.currency OR (o->>'amount')::bigint NOT BETWEEN 0 AND a.amount_minor THEN RAISE EXCEPTION 'Invalid dispute'; END IF;
   INSERT INTO public.invoice_stripe_disputes(dispute_id,attempt_id,amount_minor,status,event_created)
   VALUES(o->>'id',a.id,(o->>'amount')::bigint,o->>'status',coalesce((p_event->>'created')::bigint,0))
   ON CONFLICT(dispute_id) DO UPDATE SET amount_minor=excluded.amount_minor,status=excluded.status,event_created=excluded.event_created
   WHERE invoice_stripe_disputes.event_created<=excluded.event_created AND NOT(invoice_stripe_disputes.status IN ('won','lost') AND excluded.status NOT IN ('won','lost'));
   PERFORM public.refresh_invoice_stripe_balance(i.id);
   UPDATE public.stripe_job_payments SET status=CASE
    WHEN EXISTS(SELECT 1 FROM public.invoice_stripe_disputes WHERE attempt_id=a.id AND status<>'won') THEN 'disputed'
    WHEN EXISTS(SELECT 1 FROM public.invoice_stripe_reversals WHERE attempt_id=a.id AND amount_minor>0) THEN 'refunded' ELSE 'paid' END,
    disputed_at=now(),last_stripe_event_id=p_event->>'id',updated_at=now() WHERE invoice_id=i.id;
 ELSE RAISE EXCEPTION 'Unsupported transport payment event';
 END IF;
 UPDATE public.stripe_webhook_events SET processing_status='processed',processed_at=now(),error_message=NULL WHERE stripe_event_id=p_event->>'id';
 RETURN jsonb_build_object('received',true);
END; $$;

REVOKE ALL ON FUNCTION public.prepare_invoice_stripe_attempt(uuid,uuid,text,boolean,text),public.bind_invoice_stripe_session(uuid,text,text),public.apply_invoice_stripe_event(jsonb,boolean),public.guard_invoice_external_payment() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_invoice_stripe_attempt(uuid,uuid,text,boolean,text),public.bind_invoice_stripe_session(uuid,text,text),public.apply_invoice_stripe_event(jsonb,boolean),public.guard_invoice_external_payment() TO service_role;

CREATE TABLE public.invoice_delivery_outbox (
 invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id),
 payload jsonb,
 provider_message_id text,
 first_provider_attempt_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_delivery_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_delivery_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.invoice_delivery_outbox TO service_role;
CREATE FUNCTION public.enqueue_generated_invoice_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.invoice_generation_idempotency_key IS NOT NULL AND NEW.job_id IS NOT NULL THEN
  INSERT INTO public.invoice_delivery_outbox(invoice_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_generated_invoice_delivery() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_enqueue_generated_invoice_delivery AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.enqueue_generated_invoice_delivery();

-- Freeze recipient and fiscal linkage once an immutable email snapshot exists.
CREATE FUNCTION public.guard_invoice_delivery_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF ((to_jsonb(OLD)->>'delivery_state')='sending' OR EXISTS(SELECT 1 FROM public.invoice_delivery_outbox WHERE invoice_id=OLD.id AND payload IS NOT NULL))
 AND (NEW.client_email IS DISTINCT FROM OLD.client_email OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.company_id IS DISTINCT FROM OLD.company_id
 OR to_jsonb(NEW)->'client_name' IS DISTINCT FROM to_jsonb(OLD)->'client_name'
 OR NEW.currency IS DISTINCT FROM OLD.currency
 OR to_jsonb(NEW)->'invoice_number' IS DISTINCT FROM to_jsonb(OLD)->'invoice_number') THEN
  RAISE EXCEPTION 'Issued delivery snapshot is immutable' USING ERRCODE='23514';
 END IF;
 IF lower(NEW.status::text) IN ('cancelled','void') AND EXISTS(SELECT 1 FROM public.invoice_stripe_attempts WHERE invoice_id=OLD.id AND status IN ('reserved','open','processing')) THEN
  RAISE EXCEPTION 'Reconcile the active Stripe Checkout before cancelling this invoice' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_invoice_delivery_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_guard_invoice_delivery_snapshot BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_delivery_snapshot();

-- Reuse the existing private application settings and pg_net/pg_cron infrastructure.
CREATE FUNCTION public.dispatch_invoice_delivery_outbox() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE secret text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.invoice_delivery_outbox WHERE completed_at IS NULL AND next_attempt_at<=now()) THEN RETURN; END IF;
 SELECT value INTO secret FROM public.app_settings WHERE key='supabase_service_role_key' LIMIT 1;
 IF secret IS NULL THEN RAISE WARNING 'Invoice outbox dispatcher requires service authentication configuration'; RETURN; END IF;
 PERFORM net.http_post(url:='https://www.xdrivelogistics.co.uk/api/internal/invoice-deliveries',headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=90000);
END; $$;
REVOKE ALL ON FUNCTION public.dispatch_invoice_delivery_outbox() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_invoice_delivery_outbox() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AND EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
  PERFORM cron.schedule('invoice-delivery-outbox','*/5 * * * *','SELECT public.dispatch_invoice_delivery_outbox()');
 END IF;
END; $$;

ALTER TABLE public.invoice_delivery_outbox ADD COLUMN provider_status text NOT NULL DEFAULT 'pending', ADD COLUMN provider_event_at timestamptz;
CREATE UNIQUE INDEX invoice_delivery_provider_message ON public.invoice_delivery_outbox(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE public.invoice_delivery_events(event_id text PRIMARY KEY,invoice_id uuid NOT NULL REFERENCES public.invoices(id),event_type text NOT NULL,created_at timestamptz NOT NULL);
ALTER TABLE public.invoice_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_delivery_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.invoice_delivery_events TO service_role;
CREATE FUNCTION public.apply_invoice_email_event(p_id text,p_message text,p_type text,p_created timestamptz,p_recipient text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.invoice_delivery_outbox;
BEGIN
 SELECT * INTO d FROM public.invoice_delivery_outbox WHERE provider_message_id=p_message FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Email acceptance record is not available yet; retry'; END IF;
 IF lower(p_recipient) IS DISTINCT FROM lower(d.payload#>>'{to,0}') THEN RAISE EXCEPTION 'Email recipient mismatch'; END IF;
 IF p_type NOT IN ('email.delivered','email.bounced','email.complained','email.delivery_delayed','email.failed') THEN RAISE EXCEPTION 'Unsupported email event'; END IF;
 INSERT INTO public.invoice_delivery_events VALUES(p_id,d.invoice_id,p_type,p_created) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN jsonb_build_object('duplicate',true); END IF;
 IF (d.provider_event_at IS NULL OR d.provider_event_at<=p_created) AND NOT(d.provider_status IN ('email.bounced','email.complained','email.failed') AND p_type IN ('email.delivered','email.delivery_delayed')) THEN
  UPDATE public.invoice_delivery_outbox SET provider_status=p_type,provider_event_at=p_created,last_error=CASE WHEN p_type IN ('email.bounced','email.complained','email.failed') THEN p_type ELSE NULL END WHERE invoice_id=d.invoice_id;
  UPDATE public.invoices SET delivery_error=CASE WHEN p_type IN ('email.bounced','email.complained','email.failed') THEN 'Provider reported '||p_type||'. Finance review required; automatic resend is disabled.' ELSE NULL END WHERE id=d.invoice_id;
 END IF;
 RETURN jsonb_build_object('received',true);
END; $$;
REVOKE ALL ON FUNCTION public.apply_invoice_email_event(text,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invoice_email_event(text,text,text,timestamptz,text) TO service_role;
COMMIT;
