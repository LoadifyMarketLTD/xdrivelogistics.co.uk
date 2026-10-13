import fs from 'node:fs';
import path from 'node:path';

describe('Viewer CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/ViewerDashboardHome.tsx'),
    'utf8',
  );

  it('keeps the viewer intentionally simple and read only inside the canonical dashboard model', () => {
    expect(source).toContain('title="Reports & Statistics"');
    expect(source).toContain('title="Activity at a glance"');
    expect(source).toContain('Read-only operational position.');
    expect(source).toContain('Read-only routes available to this workspace.');
    expect(source).not.toContain('<DashboardHomeHeader');
  });

  it('keeps the activity table after the compact four-metric summary', () => {
    expect((source.match(/<KpiCard/g) ?? []).length).toBe(4);
    expect(source.indexOf('<KpiGrid>')).toBeLessThan(source.indexOf('title="Activity at a glance"'));
    expect(source).toContain("columns={['Route', 'Pickup', 'Delivery', 'Status', 'Open']}");
  });

  it('contains navigation-only actions and no lifecycle mutation call', () => {
    expect(source).toContain("router.push('/admin/jobs')");
    expect(source).not.toContain('driver_update_job_status_atomic');
    expect(source).not.toContain('assign-driver');
    expect(source).not.toContain('supabase.rpc');
  });

  it('keeps unavailable job data truthful', () => {
    expect(source).toContain("unavailable(data, ['jobs']) ? 'Job data unavailable' : 'No jobs visible'");
  });
});
