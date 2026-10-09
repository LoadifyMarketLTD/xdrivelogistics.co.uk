import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'app/driver/page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/driver/jobs/[jobId]/cancellation/route.ts'), 'utf8');

describe('Driver awarded-job cancellation request contract', () => {
  it('exposes Decline only for allocated or accepted driver work', () => {
    expect(dashboard).toContain("['allocated', 'accepted'].includes(currentStatus)");
    expect(dashboard).toContain("const canDecline = ['allocated', 'accepted'].includes(lifecycleStatus)");
    expect(dashboard).toContain("decliningJobId === currentJob.id ? 'Sending…' : 'Decline'");
    expect(dashboard).toContain("decliningJobId === job.id ? 'Sending…' : 'Decline'");
  });

  it('requires a meaningful cancellation reason and authenticated session', () => {
    expect(dashboard).toContain('A cancellation reason of at least 5 characters is required.');
    expect(dashboard).toContain('supabase.auth.refreshSession()');
    expect(dashboard).toContain('/cancellation');
    expect(route).toContain('requireActiveWebDriver(request)');
    expect(route).toContain('isWebDriverContext(driver)');
    expect(route).toContain('reason.length < 5');
  });

  it('delegates cancellation authority to the atomic server RPC', () => {
    expect(route).toContain("supabaseAdmin.rpc('request_awarded_job_cancellation_atomic'");
    expect(route).toContain('p_actor_user_id: driver.userId');
    expect(route).toContain('p_reason: reason');
    expect(route).not.toContain(".from('jobs').update(");
  });
});
