import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
  'utf8',
);

const functionConfig = readFileSync(
  resolve(process.cwd(), 'supabase/config.toml'),
  'utf8',
);

const triggerMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260820103000_notification_retry_leases_and_cron.sql'),
  'utf8',
);

describe('notification Edge Function authentication contract', () => {
  it('preserves the canonical local XDrive project and PostgreSQL identities', () => {
    expect(functionConfig).toMatch(/^project_id\s*=\s*"xdrive-prelive"\s*$/m);
    expect(functionConfig).toMatch(/\[db\][\s\S]*major_version\s*=\s*17/);
  });

  it('deploys the worker with gateway JWT verification disabled so private in-function auth can run', () => {
    expect(functionConfig).toContain('[functions.notify-operational-event]');
    expect(functionConfig).toMatch(
      /\[functions\.notify-operational-event\][\s\S]*verify_jwt\s*=\s*false/,
    );
    expect(source).toContain('if (!webhookAuthorized && !serviceRoleAuthorized)');
  });

  it('accepts the canonical service-role Bearer caller used by the DB trigger', () => {
    expect(triggerMigration).toContain("'Authorization', 'Bearer ' || v_service_role_key");
    expect(source).toContain('const serviceBearer = bearerToken(request);');
    expect(source).toContain('const serviceRoleAuthorized = constantTimeEqual(serviceBearer, serviceRoleKey);');
    expect(source).toContain('if (!webhookAuthorized && !serviceRoleAuthorized)');
  });

  it('keeps the optional private webhook-secret path fail-closed', () => {
    expect(source).toContain("request.headers.get('x-xdrive-webhook-secret')");
    expect(source).toContain('webhookSecret.length >= 32');
    expect(source).toContain('constantTimeEqual(suppliedSecret, webhookSecret)');
  });

  it('recognises the event_id payload emitted by the canonical DB trigger', () => {
    expect(triggerMigration).toContain("'event_id', NEW.id");
    expect(triggerMigration).toContain("'event_type', NEW.event_type");
    expect(source).toContain('body?.record?.id ?? body?.id ?? body?.event_id ?? null');
  });

  it('uses the canonical pg_net API instead of the historical extensions.http_post call', () => {
    expect(triggerMigration).toContain('PERFORM net.http_post(');
    expect(triggerMigration).toContain('timeout_milliseconds := 5000');
    expect(triggerMigration).not.toContain('extensions.http_post');
  });
});
