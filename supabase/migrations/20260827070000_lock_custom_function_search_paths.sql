begin;

-- Harden every function that exists in the canonical replay at this point.
-- Some older hosted environments contained legacy helpers (for example
-- accept_bid(uuid, uuid)) that are intentionally absent from a clean bootstrap;
-- IF EXISTS keeps the security hardening replay-safe without recreating obsolete
-- RPCs merely to satisfy this migration.
alter function if exists public.accept_bid(uuid, uuid) set search_path to public, pg_temp;
alter function if exists public.assign_job_customer_ref() set search_path to public, pg_temp;
alter function if exists public.assign_xd_company_id() set search_path to public, pg_temp;
alter function if exists public.assign_xd_user_id() set search_path to public, pg_temp;
alter function if exists public.coalesce_driver_full_name() set search_path to public, pg_temp;
alter function if exists public.coalesce_driver_name() set search_path to public, pg_temp;
alter function if exists public.current_company_id() set search_path to public, pg_temp;
alter function if exists public.enforce_asap_direct_delivery() set search_path to public, pg_temp;
alter function if exists public.fn_calculate_invoice_payment_status(numeric, numeric) set search_path to public, pg_temp;
alter function if exists public.fn_job_bids_fill_bid_price_gbp() set search_path to public, pg_temp;
alter function if exists public.fn_notification_event_body(text, jsonb) set search_path to public, pg_temp;
alter function if exists public.fn_notification_event_title(text) set search_path to public, pg_temp;
alter function if exists public.generate_xd_company_id() set search_path to public, pg_temp;
alter function if exists public.generate_xd_user_id() set search_path to public, pg_temp;
alter function if exists public.is_company_admin_of(uuid, uuid) set search_path to public, pg_temp;
alter function if exists public.is_owner(uuid) set search_path to public, pg_temp;
alter function if exists public.job_bids_fill_quote_amount() set search_path to public, pg_temp;
alter function if exists public.normalize_doc_type(text) set search_path to public, pg_temp;
alter function if exists public.normalize_profile_role(text, text) set search_path to public, pg_temp;
alter function if exists public.prevent_unsafe_driver_delete() set search_path to public, pg_temp;
alter function if exists public.set_company_settings_updated_at() set search_path to public, pg_temp;
alter function if exists public.set_updated_at() set search_path to public, pg_temp;
alter function if exists public.support_tickets_set_timestamps() set search_path to public, pg_temp;
alter function if exists public.sync_job_assignment_from_accepted_bid() set search_path to public, pg_temp;
alter function if exists public.tg_job_bids_fill_bid_price_gbp() set search_path to public, pg_temp;
alter function if exists public.touch_job_disputes_updated_at() set search_path to public, pg_temp;
alter function if exists public.touch_platform_settings_updated_at() set search_path to public, pg_temp;
alter function if exists public.touch_updated_at_company_documents() set search_path to public, pg_temp;
alter function if exists public.touch_updated_at_generic() set search_path to public, pg_temp;
alter function if exists public.update_invoices_updated_at() set search_path to public, pg_temp;
alter function if exists public.update_timestamp_function() set search_path to public, pg_temp;
alter function if exists public.update_updated_at_column() set search_path to public, pg_temp;

commit;
