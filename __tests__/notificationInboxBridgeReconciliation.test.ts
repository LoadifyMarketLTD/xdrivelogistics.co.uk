import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260826094600_notification_inbox_bridge_reconciliation.sql'),
  'utf8',
);
const inboxApi = readFileSync(
  resolve(process.cwd(), 'app/api/workspace/notifications/route.ts'),
  'utf8',
);

describe('Notification inbox bridge reconciliation', () => {
  it('bridges recipient-scoped outbox events into the canonical inbox idempotently', () => {
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

  it('does not rewrite notification RLS or grants in the bridge migration', () => {
    expect(migration).not.toContain('DROP POLICY');
    expect(migration).not.toContain('CREATE POLICY');
    expect(migration).not.toContain('REVOKE ALL ON TABLE public.notifications');
    expect(migration).not.toContain('GRANT SELECT ON TABLE public.notifications TO authenticated');
  });

  it('keeps inbox read/update/delete operations recipient-scoped on the server', () => {
    expect(inboxApi).toContain(".from('notifications')");
    expect(inboxApi).toContain(".eq('user_id', user.id)");
    expect(inboxApi).toContain('export async function PATCH');
    expect(inboxApi).toContain('export async function DELETE');
  });

  it('supports the live-tracking ETA alert in the inbox bridge', () => {
    expect(migration).toContain("WHEN 'tracking_eta_alert' THEN 'Traffic ETA alert'");
    expect(migration).toContain("WHEN 'tracking_eta_alert' THEN COALESCE");
  });
});
