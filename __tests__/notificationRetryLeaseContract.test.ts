import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260820103000_notification_retry_leases_and_cron.sql'),
  'utf8',
);
const edge = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
  'utf8',
);

describe('notification retry lease and scheduler contract', () => {
  it('claims due queue rows atomically with an expiring lease', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.claim_notification_events');
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain("lease_expires_at = now() + interval '10 minutes'");
    expect(migration).toContain("ne.status IN ('pending', 'failed')");
    expect(migration).toContain('ne.next_attempt_at IS NULL OR ne.next_attempt_at <= now()');
  });

  it('keeps the queue claim RPC off authenticated users', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.claim_notification_events(uuid, integer)');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated;');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.claim_notification_events(uuid, integer)');
    expect(migration).toContain('TO service_role;');
  });

  it('schedules due retries every minute through canonical pg_net and the private service-role caller', () => {
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_net;');
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron;');
    expect(migration).toContain("'xdrive-notification-retry-dispatch'");
    expect(migration).toContain("'* * * * *'");
    expect(migration).toContain("'Authorization', 'Bearer ' || v_service_role_key");
    expect(migration).toContain('PERFORM net.http_post(');
    expect(migration).not.toContain('extensions.http_post');
  });

  it('keeps configuration/transport failures retryable rather than terminally skipped', () => {
    expect(migration).toContain("status = 'failed'");
    expect(migration).toContain('processed_at = NULL');
    expect(migration).toContain("next_attempt_at = now() + interval '2 minutes'");
    expect(migration).not.toContain("status = 'skipped'");
  });

  it('requires a DB lease before provider delivery and releases only its own lease', () => {
    expect(edge).toContain("supabase.rpc('claim_notification_events'");
    expect(edge).toContain('if (!leaseToken)');
    expect(edge).toContain(".eq('lease_token', leaseToken)");
    expect(edge).toContain('lease_token: null');
    expect(edge).toContain('lease_expires_at: null');
  });
});
