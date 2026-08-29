import fs from 'node:fs';
import path from 'node:path';

describe('Viewer CX convergence contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/components/workspace/ViewerDashboardHome.tsx'),
    'utf8',
  );

  it('keeps the viewer intentionally simple and read only', () => {
    expect(source).toContain('badge="Read only"');
    expect(source).toContain('Recent operational work');
    expect(source).toContain('no state-changing carrier, finance, fleet or compliance controls');
  });

  it('keeps the recent operational table immediately after the compact four-metric summary', () => {
    expect((source.match(/<KpiCard/g) ?? []).length).toBe(4);
    expect(source.indexOf('<KpiGrid>')).toBeLessThan(source.indexOf('Recent operational work'));
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
