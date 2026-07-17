-- ── Health Check: lists every expected column and whether it exists ──────────
SELECT
  e.table_name,
  e.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ exists' ELSE '❌ MISSING' END AS status
FROM (
  VALUES
    -- profiles
    ('profiles','id'),('profiles','full_name'),('profiles','phone'),
    ('profiles','email'),('profiles','role'),('profiles','company_id'),
    ('profiles','is_driver'),('profiles','created_at'),('profiles','updated_at'),
    -- companies
    ('companies','id'),('companies','name'),('companies','company_number'),
    ('companies','vat_number'),('companies','email'),('companies','phone'),
    ('companies','address_line1'),('companies','address_line2'),
    ('companies','city'),('companies','postcode'),('companies','country'),
    ('companies','status'),('companies','company_type'),
    ('companies','created_by'),('companies','created_at'),
    -- company_memberships
    ('company_memberships','id'),('company_memberships','company_id'),
    ('company_memberships','user_id'),('company_memberships','invited_email'),
    ('company_memberships','role_in_company'),('company_memberships','status'),
    ('company_memberships','created_at'),('company_memberships','updated_at'),
    -- drivers
    ('drivers','id'),('drivers','company_id'),('drivers','user_id'),
    ('drivers','display_name'),('drivers','phone'),('drivers','email'),
    ('drivers','status'),('drivers','login_pin'),('drivers','app_access'),
    ('drivers','last_app_login'),('drivers','device_token'),('drivers','created_at'),
    -- vehicles
    ('vehicles','id'),('vehicles','company_id'),('vehicles','assigned_driver_id'),
    ('vehicles','type'),('vehicles','reg_plate'),('vehicles','make'),
    ('vehicles','model'),('vehicles','payload_kg'),('vehicles','pallets_capacity'),
    ('vehicles','has_tail_lift'),('vehicles','has_straps'),('vehicles','has_blankets'),
    ('vehicles','created_at'),
    -- jobs
    ('jobs','id'),('jobs','company_id'),('jobs','created_by'),
    ('jobs','assigned_driver_id'),('jobs','status'),('jobs','vehicle_type'),
    ('jobs','cargo_type'),('jobs','pickup_location'),('jobs','pickup_postcode'),
    ('jobs','pickup_lat'),('jobs','pickup_lng'),('jobs','pickup_datetime'),
    ('jobs','delivery_location'),('jobs','delivery_postcode'),
    ('jobs','delivery_lat'),('jobs','delivery_lng'),('jobs','delivery_datetime'),
    ('jobs','pallets'),('jobs','boxes'),('jobs','bags'),('jobs','items'),
    ('jobs','weight_kg'),('jobs','length_cm'),('jobs','width_cm'),('jobs','height_cm'),
    ('jobs','currency'),('jobs','budget_amount'),('jobs','is_fixed_price'),
    ('jobs','load_details'),('jobs','special_requirements'),('jobs','access_restrictions'),
    ('jobs','job_distance_miles'),('jobs','job_distance_minutes'),
    ('jobs','distance_to_pickup_miles'),
    ('jobs','collection_photo_url'),('jobs','delivery_photos'),
    ('jobs','delivery_signature_data'),('jobs','status_history'),
    ('jobs','driver_notes'),('jobs','client_signature_name'),
    ('jobs','created_at'),('jobs','updated_at'),
    -- job_bids
    ('job_bids','id'),('job_bids','job_id'),('job_bids','company_id'),
    ('job_bids','bidder_user_id'),('job_bids','bidder_id'),
    ('job_bids','bidder_driver_id'),('job_bids','amount'),('job_bids','bid_price_gbp'),
    ('job_bids','currency'),('job_bids','message'),('job_bids','status'),
    ('job_bids','created_at'),
    -- quotes
    ('quotes','id'),('quotes','company_id'),('quotes','created_by'),
    ('quotes','customer_name'),('quotes','customer_email'),('quotes','customer_phone'),
    ('quotes','pickup_location'),('quotes','delivery_location'),
    ('quotes','vehicle_type'),('quotes','cargo_type'),
    ('quotes','amount'),('quotes','currency'),('quotes','status'),('quotes','created_at'),
    -- invoices
    ('invoices','id'),('invoices','company_id'),('invoices','created_by'),
    ('invoices','invoice_number'),('invoices','job_ref'),('invoices','job_id'),
    ('invoices','invoice_date'),('invoices','due_date'),('invoices','status'),
    ('invoices','client_name'),('invoices','client_address'),('invoices','client_email'),
    ('invoices','pickup_location'),('invoices','pickup_datetime'),
    ('invoices','delivery_location'),('invoices','delivery_datetime'),
    ('invoices','delivery_recipient'),('invoices','service_description'),
    ('invoices','amount'),('invoices','net_amount'),('invoices','vat_amount'),
    ('invoices','vat_rate'),('invoices','currency'),('invoices','payment_terms'),
    ('invoices','late_fee'),('invoices','pod_photos'),('invoices','signature'),
    ('invoices','recipient_name'),('invoices','created_at'),('invoices','updated_at'),
    -- driver_locations
    ('driver_locations','id'),('driver_locations','driver_id'),
    ('driver_locations','company_id'),('driver_locations','job_id'),
    ('driver_locations','lat'),('driver_locations','lng'),
    ('driver_locations','heading'),('driver_locations','speed_mph'),
    ('driver_locations','recorded_at'),('driver_locations','updated_at')
) AS e(table_name, column_name)
LEFT JOIN information_schema.columns c
       ON c.table_schema = 'public'
      AND c.table_name   = e.table_name
      AND c.column_name  = e.column_name
ORDER BY e.table_name, e.column_name;
