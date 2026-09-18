do $$
declare
  v_def text;
  v_old text := 'CASE WHEN v_app.account_type = ''customer_shipper'' THEN ''active'' ELSE ''pending_approval'' END,';
  v_new text := '(CASE WHEN v_app.account_type = ''customer_shipper'' THEN ''active'' ELSE ''pending_approval'' END)::public.company_status,';
begin
  select pg_get_functiondef('public.submit_onboarding_application_base_v1(uuid)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'Expected onboarding company status expression not found';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;;
