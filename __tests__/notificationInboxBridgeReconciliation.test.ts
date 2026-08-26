import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260826094600_notification_inbox_bridge_reconciliation.sql'),
  'utf8',
);

const androidApi = readFileSync(
  resolve(process.cwd(), 'android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/ApiClient.kt'),
  'utf8',
);

describe('Android notification inbox bridge reconciliation', () => {
  it('bridges recipient-scoped outbox events into the Android inbox idempotently', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.fn_bridge_notification_event_to_inbox()');
    expect(migration).toContain('IF NEW.recipient_user_id IS NULL THEN');
    expect(migration).toContain('INSERT INTO public.notifications');
    expect(migration).toContain('ON CONFLICT (id) DO NOTHING');
    expect(migration).toContain('CREATE TRIGGER trg_bridge_notification_event_to_inbox');
  });

  it('keeps the privileged trigger function off public authenticated callers', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.fn_bridge_notification_event_to_inbox() FROM PUBLIC, anon, authenticated;');
  });

  it('does not rewrite notifications RLS or grants used by Android read/update/delete', () => {
    expect(migration).not.toContain('DROP POLICY');
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).not.toContain('REVOKE ALL ON TABLE public.notifications');
    expect(migration).not.toContain('GRANT SELECT ON TABLE public.notifications TO authenticated');
    expect(androidApi).toContain('/rest/v1/notifications?select=id,title,body,type,read_at,created_at');
    expect(androidApi).toContain('.patch(');
    expect(androidApi).toContain('.delete()');
  });

  it('supports the new live-tracking ETA alert in the Android inbox', () => {
    expect(migration).toContain("WHEN 'tracking_eta_alert' THEN 'Traffic ETA alert'");
    expect(migration).toContain("WHEN 'tracking_eta_alert' THEN COALESCE");
  });
});
