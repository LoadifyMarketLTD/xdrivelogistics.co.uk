import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
  'utf8',
);

const triggerMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/115_observable_email_trigger_settings.sql'),
  'utf8',
);

describe('notification Edge Function authentication contract', () => {
  it('accepts the canonical service-role Bearer caller used by the DB trigger', () => {
    expect(triggerMigration).toContain("'Authorization', 'Bearer ' || _service_role_key");
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
    expect(triggerMigration).toContain("jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type)");
    expect(source).toContain('body?.record?.id ?? body?.id ?? body?.event_id ?? null');
  });
});
