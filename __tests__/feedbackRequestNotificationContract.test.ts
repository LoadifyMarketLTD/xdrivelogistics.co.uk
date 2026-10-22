import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261019080500_feedback_request_notifications.sql'),
  'utf8',
);
const notify = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
  'utf8',
);

describe('feedback request notification contract', () => {
  it('queues feedback only on the first transition to completed', () => {
    expect(migration).toContain("v_new_status <> 'completed' or v_old_status = 'completed'");
    expect(migration).toContain('after update of status, current_status on public.jobs');
  });

  it('queues both buyer and carrier reviewers but excludes internal work', () => {
    expect(migration).toContain('v_buyer_company_id = v_carrier_company_id');
    expect(migration).toContain('(v_buyer_company_id, v_carrier_company_id)');
    expect(migration).toContain('(v_carrier_company_id, v_buyer_company_id)');
    expect(migration).toContain("member.role_in_company in ('owner', 'admin', 'dispatcher')");
  });

  it('uses the canonical notification outbox idempotently', () => {
    expect(migration).toContain("'feedback_requested'");
    expect(migration).toContain("'feedback-request:' || new.id::text");
    expect(migration).toContain('on conflict do nothing');
  });

  it('renders a human-reference email through the operations sender', () => {
    const handler = notify.slice(
      notify.indexOf('async function handleFeedbackRequested'),
      notify.indexOf('async function handleOnboardingInvite'),
    );
    expect(handler).toContain('getPublicJobContext(event)');
    expect(handler).toContain('Feedback requested - Ref:');
    expect(handler).toContain('How did this booking go?');
    expect(handler).toContain('Leave feedback in XDrive');
    expect(handler).toContain('Awaiting Feedback');
    expect(handler).toContain("'operations'");
    expect(handler).not.toContain('event.entity_id');
  });

  it('routes feedback_requested through the edge event processor', () => {
    expect(notify).toContain("case 'feedback_requested': success = await handleFeedbackRequested(event); break;");
  });
});
