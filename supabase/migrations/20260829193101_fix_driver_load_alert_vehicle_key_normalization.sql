-- Preserve alphabetic vehicle identity when normalizing uppercase labels.
create or replace function public.fn_load_alert_vehicle_key(p_value text)
returns text
language sql
immutable
security invoker
as $$
  select nullif(
    trim(both '_' from regexp_replace(lower(btrim(coalesce(p_value, ''))), '[^a-z0-9]+', '_', 'g')),
    ''
  );
$$;

comment on function public.fn_load_alert_vehicle_key(text) is
  'Canonicalizes vehicle labels case-insensitively before punctuation folding so uppercase type names retain their alphabetic identity.';
