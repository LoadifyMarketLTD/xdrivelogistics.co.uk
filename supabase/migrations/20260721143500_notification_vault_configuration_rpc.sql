BEGIN;

CREATE OR REPLACE FUNCTION public.configure_notification_dispatch_vault(
  p_project_url text,
  p_webhook_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_project_url text := rtrim(trim(COALESCE(p_project_url, '')), '/');
  v_webhook_secret text := trim(COALESCE(p_webhook_secret, ''));
  v_existing_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  IF v_project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' THEN
    RAISE EXCEPTION 'Notification project URL must be an HTTPS Supabase project URL.'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_webhook_secret) < 32 THEN
    RAISE EXCEPTION 'Notification webhook secret must be at least 32 characters.'
      USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_existing_id
  FROM vault.decrypted_secrets
  WHERE name = 'xdrive_notification_project_url'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(
      v_project_url,
      'xdrive_notification_project_url',
      'XDrive notification Edge Function project URL'
    );
  ELSE
    PERFORM vault.update_secret(
      v_existing_id,
      v_project_url,
      'xdrive_notification_project_url',
      'XDrive notification Edge Function project URL'
    );
  END IF;

  v_existing_id := NULL;
  SELECT id
  INTO v_existing_id
  FROM vault.decrypted_secrets
  WHERE name = 'xdrive_notification_webhook_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(
      v_webhook_secret,
      'xdrive_notification_webhook_secret',
      'Private shared secret for database-to-Edge notification dispatch'
    );
  ELSE
    PERFORM vault.update_secret(
      v_existing_id,
      v_webhook_secret,
      'xdrive_notification_webhook_secret',
      'Private shared secret for database-to-Edge notification dispatch'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_notification_dispatch_vault(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_notification_dispatch_vault(text, text)
  TO service_role;

COMMENT ON FUNCTION public.configure_notification_dispatch_vault(text, text) IS
  'Stores notification dispatch URL and webhook secret in Supabase Vault. Service role only.';

NOTIFY pgrst, 'reload schema';

COMMIT;
