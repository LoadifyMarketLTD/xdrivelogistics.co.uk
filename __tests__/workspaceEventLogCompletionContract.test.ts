import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('workspace Event Log completion', () => {
  const api = read('app/api/workspace/event-log/route.ts');
  const page = read('app/components/workspace/WorkspaceEventLogPage.tsx');

  it('keeps existing notification and job tracking sources while adding verified company and finance audit sources', () => {
    expect(api).toContain("from('notification_events')");
    expect(api).toContain("from('job_tracking_events')");
    expect(api).toContain("from('audit_logs')");
    expect(api).toContain("from('invoice_status_history')");
    expect(api).toContain("from('invoice_payment_history')");
    expect(api).toContain("from('workspace_switch_audit')");
  });

  it('scopes every company-wide source to active company membership and workspace switches to the current actor', () => {
    expect(api).toContain("companies!inner(status)");
    expect(api).toContain(".eq('companies.status', 'active')");
    expect(api).toContain(".in('company_id', companyIds)");
    expect(api).toContain(".eq('actor_user_id', authData.user.id)");
    expect(api).toContain(".in('target_company_id', companyIds)");
  });

  it('enriches verified actor identities without fabricating login/logout events', () => {
    expect(api).toContain("from('profiles')");
    expect(api).toContain('actor_name');
    expect(api).toContain('actor_email');
    expect(api).toContain('Login/logout events are not fabricated');
  });

  it('provides source/entity/actor search plus export from one shared Event Log surface', () => {
    expect(page).toContain('EVENT / REFERENCE / ACTOR');
    expect(page).toContain('All sources');
    expect(page).toContain('All entities');
    expect(page).toContain('actorLabel(event)');
    expect(page).toContain("['Date', 'Event', 'Entity', 'Reference', 'Actor', 'Source', 'Details']");
    expect(page).toContain('Download CSV');
    expect(page).toContain('Print / Save PDF');
  });

  it('preserves Journey Replay handoff only for authorised job-scoped events', () => {
    expect(page).toContain('const replayJobId = event.job_id && UUID_RE.test(event.job_id)');
    expect(page).toContain('/job-replay/${replayJobId}');
  });
});
