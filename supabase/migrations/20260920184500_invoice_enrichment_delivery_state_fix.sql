create or replace function public.fn_enrich_invoice_on_job_completion()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old_status text;
  v_new_status text;
  v_pod public.proof_of_delivery%rowtype;
  v_vehicle_registration text;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  v_old_status := lower(coalesce(nullif(old.current_status::text, ''), nullif(old.status::text, ''), ''));
  v_new_status := lower(coalesce(nullif(new.current_status::text, ''), nullif(new.status::text, ''), ''));
  if v_new_status not in ('delivered', 'completed') or v_old_status in ('delivered', 'completed') then return new; end if;

  select * into v_pod from public.proof_of_delivery where job_id = new.id order by created_at desc limit 1;
  if new.vehicle_id is not null then
    select nullif(btrim(coalesce(v.reg_plate, '')), '') into v_vehicle_registration
    from public.vehicles v where v.id = new.vehicle_id limit 1;
  end if;

  update public.invoices i set
    vehicle_type = coalesce(nullif(btrim(coalesce(new.requested_vehicle_label, '')), ''), nullif(btrim(coalesce(new.vehicle_type, '')), ''), nullif(btrim(coalesce(new.requested_vehicle_type, '')), ''), i.vehicle_type),
    vehicle_registration = coalesce(v_vehicle_registration, i.vehicle_registration),
    load_id = coalesce(nullif(btrim(coalesce(new.load_ref, '')), ''), nullif(btrim(coalesce(new.load_id, '')), ''), nullif(btrim(coalesce(new.load_reference, '')), ''), 'XDL-' || upper(substr(new.id::text, 1, 8)), i.load_id),
    customer_ref = coalesce(nullif(btrim(coalesce(new.customer_reference, '')), ''), nullif(btrim(coalesce(new.customer_ref, '')), ''), nullif(btrim(coalesce(new.cust_ref, '')), ''), nullif(btrim(coalesce(new.your_ref, '')), ''), nullif(btrim(coalesce(new.booking_reference, '')), ''), i.customer_ref),
    delivery_recipient = coalesce(nullif(btrim(coalesce(v_pod.received_by, '')), ''), nullif(btrim(coalesce(new.delivery_contact_name, '')), ''), i.delivery_recipient),
    delivery_notes = coalesce(nullif(btrim(coalesce(v_pod.delivery_notes, '')), ''), nullif(btrim(coalesce(new.delivery_notes, '')), ''), i.delivery_notes),
    no_of_items = coalesce(v_pod.no_of_items, new.pallets, i.no_of_items),
    left_at = coalesce(nullif(btrim(coalesce(v_pod.left_at, '')), ''), i.left_at),
    pod_required = coalesce(i.pod_required,false) or coalesce(new.pod_required,false),
    pod_generated = coalesce(i.pod_generated,false) or coalesce(new.pod_generated,false) or v_pod.id is not null,
    pod_generated_at = coalesce(new.pod_generated_at, v_pod.updated_at, i.pod_generated_at, now()),
    pod_photos = coalesce(to_jsonb(v_pod.photo_urls), new.delivery_photos, i.pod_photos),
    signature = coalesce(case when new.delivery_signature_data is not null and jsonb_typeof(new.delivery_signature_data)='string' then new.delivery_signature_data #>> '{}' else null end, i.signature),
    recipient_name = coalesce(nullif(btrim(coalesce(v_pod.received_by, '')), ''), i.recipient_name),
    pod_delivery_status_snapshot = coalesce(nullif(btrim(coalesce(v_pod.delivery_status, '')), ''), nullif(btrim(coalesce(new.delivery_status, '')), ''), i.pod_delivery_status_snapshot),
    ordered_at = coalesce(new.created_at, i.ordered_at),
    delivered_at = coalesce(new.delivered_at, new.completed_at, v_pod.updated_at, new.pod_generated_at, i.delivered_at),
    cargo_summary = coalesce(nullif(concat_ws(' · ', case when new.pallets is not null then new.pallets::text || case when new.pallets=1 then ' pallet' else ' pallets' end end, case when new.weight_kg is not null then trim(to_char(new.weight_kg, 'FM999999990.##')) || ' kg' end), ''), i.cargo_summary),
    issuer_name_snapshot = coalesce((select coalesce(nullif(btrim(c.legal_name), ''), nullif(btrim(c.trading_name), ''), nullif(btrim(c.name), '')) from public.companies c where c.id=i.supplier_company_id), i.issuer_name_snapshot),
    issuer_address_snapshot = coalesce((select nullif(concat_ws(', ',nullif(btrim(c.address_line1),''),nullif(btrim(c.address_line2),''),nullif(btrim(c.city),''),nullif(btrim(c.postcode),''),nullif(btrim(c.country),'')),'') from public.companies c where c.id=i.supplier_company_id), i.issuer_address_snapshot),
    issuer_company_number_snapshot = coalesce((select nullif(btrim(c.company_number),'') from public.companies c where c.id=i.supplier_company_id), i.issuer_company_number_snapshot),
    issuer_vat_number_snapshot = coalesce((select nullif(btrim(c.vat_number),'') from public.companies c where c.id=i.supplier_company_id), i.issuer_vat_number_snapshot),
    issuer_xd_id_snapshot = coalesce((select nullif(btrim(c.xd_id),'') from public.companies c where c.id=i.supplier_company_id), i.issuer_xd_id_snapshot),
    issuer_email_snapshot = coalesce((select nullif(btrim(c.email),'') from public.companies c where c.id=i.supplier_company_id), i.issuer_email_snapshot),
    issuer_phone_snapshot = coalesce((select nullif(btrim(c.phone),'') from public.companies c where c.id=i.supplier_company_id), i.issuer_phone_snapshot),
    customer_company_number_snapshot = coalesce((select nullif(btrim(c.company_number),'') from public.companies c where c.id=i.buyer_company_id), i.customer_company_number_snapshot),
    customer_vat_number_snapshot = coalesce((select nullif(btrim(c.vat_number),'') from public.companies c where c.id=i.buyer_company_id), i.customer_vat_number_snapshot),
    customer_xd_id_snapshot = coalesce((select nullif(btrim(c.xd_id),'') from public.companies c where c.id=i.buyer_company_id), i.customer_xd_id_snapshot),
    bank_account_name_snapshot = coalesce((select nullif(btrim(cs.bank_account_name),'') from public.company_settings cs where cs.company_id=i.supplier_company_id), i.bank_account_name_snapshot),
    bank_sort_code_snapshot = coalesce((select nullif(btrim(cs.bank_sort_code),'') from public.company_settings cs where cs.company_id=i.supplier_company_id), i.bank_sort_code_snapshot),
    bank_account_number_snapshot = coalesce((select nullif(btrim(cs.bank_account_number),'') from public.company_settings cs where cs.company_id=i.supplier_company_id), i.bank_account_number_snapshot),
    updated_at = now()
  where i.job_id=new.id;
  return new;
end;
$function$;
