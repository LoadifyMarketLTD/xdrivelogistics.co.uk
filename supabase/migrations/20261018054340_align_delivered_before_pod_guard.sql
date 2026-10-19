-- 2026-10-17: align Delivered -> POD -> Invoice sequencing.
-- Delivered requires persistent delivery evidence, but signature/recipient are
-- completed by the POD endpoint after the Delivered transition.
create or replace function public.fn_jobs_mvp_guardrails()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_allowed_next text[];
  v_carrier_company_id uuid;
  v_issues text[];
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_undo_entry jsonb;
  v_request_role text;
  v_is_driver_undo boolean := false;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_allowed_next := case lower(coalesce(old.status::text, ''))
      when 'draft' then array['posted', 'cancelled', 'disputed']
      when 'open' then array['posted', 'allocated', 'cancelled', 'disputed']
      when 'received' then array['posted', 'allocated', 'cancelled', 'disputed']
      when 'posted' then array['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
      when 'quoted' then array['posted', 'awarded', 'allocated', 'accepted', 'cancelled', 'disputed']
      when 'awarded' then array['allocated', 'on_my_way', 'cancelled', 'disputed']
      when 'allocated' then array['accepted', 'on_my_way', 'cancelled', 'disputed']
      when 'accepted' then array['on_my_way', 'cancelled', 'disputed']
      when 'on_my_way' then array['on_site_pickup', 'cancelled', 'disputed']
      when 'on_my_way_to_pickup' then array['on_site_pickup', 'cancelled', 'disputed']
      when 'arrived_pickup' then array['loaded', 'cancelled', 'disputed']
      when 'on_site_pickup' then array['loaded', 'cancelled', 'disputed']
      when 'loaded' then array['in_transit', 'cancelled', 'disputed']
      when 'collected' then array['in_transit', 'cancelled', 'disputed']
      when 'in_transit' then array['on_site_delivery', 'cancelled', 'disputed']
      when 'on_my_way_to_delivery' then array['on_site_delivery', 'cancelled', 'disputed']
      when 'arrived_delivery' then array['delivered', 'cancelled', 'disputed']
      when 'on_site_delivery' then array['delivered', 'cancelled', 'disputed']
      when 'delivered' then array['completed']
      when 'completed' then array[]::text[]
      when 'invoiced' then array['paid']
      when 'paid' then array[]::text[]
      when 'cancelled' then array[]::text[]
      when 'disputed' then array[]::text[]
      else array[]::text[]
    end;

    if jsonb_typeof(coalesce(new.status_history, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(new.status_history, '[]'::jsonb)) > 0 then
      v_undo_entry := new.status_history -> (jsonb_array_length(new.status_history) - 1);
    end if;

    v_request_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
    );

    v_is_driver_undo :=
      v_request_role = 'service_role'
      and old.assigned_driver_id is not null
      and coalesce(v_undo_entry ->> 'source', '') = 'driver_mobile_undo'
      and lower(coalesce(v_undo_entry ->> 'undone_from', '')) = lower(coalesce(old.status::text, ''))
      and exists (
        select 1
        from public.drivers d
        where d.id = old.assigned_driver_id
          and d.user_id::text = coalesce(v_undo_entry ->> 'actor_user_id', '')
      )
      and (
        (lower(coalesce(old.status::text, '')) = 'accepted' and lower(coalesce(new.status::text, '')) = 'allocated')
        or (lower(coalesce(old.status::text, '')) = 'on_my_way' and lower(coalesce(new.status::text, '')) = 'accepted')
        or (lower(coalesce(old.status::text, '')) = 'on_site_pickup' and lower(coalesce(new.status::text, '')) = 'on_my_way')
        or (lower(coalesce(old.status::text, '')) = 'loaded' and lower(coalesce(new.status::text, '')) = 'on_site_pickup')
        or (lower(coalesce(old.status::text, '')) = 'in_transit' and lower(coalesce(new.status::text, '')) = 'loaded')
        or (lower(coalesce(old.status::text, '')) = 'on_site_delivery' and lower(coalesce(new.status::text, '')) = 'in_transit')
      );

    if not (lower(coalesce(new.status::text, '')) = any (v_allowed_next))
       and not v_is_driver_undo then
      raise exception 'Invalid job status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if lower(coalesce(new.status::text, '')) = 'loaded'
       and nullif(btrim(coalesce(new.collection_photo_url, '')), '') is null then
      raise exception 'A loading photo is required before marking the job loaded.'
        using errcode = '23514';
    end if;

    if lower(coalesce(new.status::text, '')) = 'delivered'
       and coalesce(new.pod_required, true) then
      if jsonb_typeof(coalesce(new.delivery_photos, '[]'::jsonb)) = 'array' then
        v_delivery_photo_count := jsonb_array_length(coalesce(new.delivery_photos, '[]'::jsonb));
      end if;
      if jsonb_typeof(coalesce(new.pod_photos, '[]'::jsonb)) = 'array' then
        v_pod_photo_count := jsonb_array_length(coalesce(new.pod_photos, '[]'::jsonb));
      end if;

      if v_delivery_photo_count + v_pod_photo_count < 1 then
        raise exception 'At least one delivery photo or POD document is required before delivery.'
          using errcode = '23514';
      end if;
    end if;
  end if;

  if new.exchange_visibility = 'exchange'
     and (tg_op = 'INSERT' or coalesce(old.exchange_visibility, '') <> 'exchange') then
    v_issues := public.company_compliance_issues(new.company_id, 'publish');
    if coalesce(array_length(v_issues, 1), 0) > 0 then
      raise exception 'Compliance blocked publish action: %', array_to_string(v_issues, ' ')
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if lower(coalesce(new.status::text, '')) in (
      'awarded', 'allocated', 'accepted', 'on_my_way', 'on_site_pickup', 'loaded',
      'in_transit', 'on_site_delivery', 'delivered', 'completed'
    ) then
      v_carrier_company_id := coalesce(new.awarded_carrier_company_id, new.assigned_company_id, new.company_id);
      v_issues := public.company_compliance_issues(v_carrier_company_id, 'execution');
      if coalesce(array_length(v_issues, 1), 0) > 0 then
        raise exception 'Compliance blocked execution action: %', array_to_string(v_issues, ' ')
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$function$;
