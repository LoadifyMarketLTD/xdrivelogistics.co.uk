begin;

-- This migration hardens functions that exist in hosted production, including
-- historical drift functions that are not necessarily reconstructed by a clean
-- repository replay. Harden every known signature that exists without making
-- the schema depend on recreating retired/out-of-band functions.
do $$
declare
  v_signature text;
  v_signatures text[] := array[
    'public.accept_bid(uuid,uuid)',
    'public.assign_job_customer_ref()',
    'public.assign_xd_company_id()',
    'public.assign_xd_user_id()',
    'public.coalesce_driver_full_name()',
    'public.coalesce_driver_name()',
    'public.current_company_id()',
    'public.enforce_asap_direct_delivery()',
    'public.fn_calculate_invoice_payment_status(numeric,numeric)',
    'public.fn_job_bids_fill_bid_price_gbp()',
    'public.fn_notification_event_body(text,jsonb)',
    'public.fn_notification_event_title(text)',
    'public.generate_xd_company_id()',
    'public.generate_xd_user_id()',
    'public.is_company_admin_of(uuid,uuid)',
    'public.is_owner(uuid)',
    'public.job_bids_fill_quote_amount()',
    'public.normalize_doc_type(text)',
    'public.normalize_profile_role(text,text)',
    'public.prevent_unsafe_driver_delete()',
    'public.set_company_settings_updated_at()',
    'public.set_updated_at()',
    'public.support_tickets_set_timestamps()',
    'public.sync_job_assignment_from_accepted_bid()',
    'public.tg_job_bids_fill_bid_price_gbp()',
    'public.touch_job_disputes_updated_at()',
    'public.touch_platform_settings_updated_at()',
    'public.touch_updated_at_company_documents()',
    'public.touch_updated_at_generic()',
    'public.update_invoices_updated_at()',
    'public.update_timestamp_function()',
    'public.update_updated_at_column()'
  ];
begin
  foreach v_signature in array v_signatures loop
    if to_regprocedure(v_signature) is not null then
      execute format('alter function %s set search_path to public, pg_temp', v_signature);
    end if;
  end loop;
end;
$$;

commit;
