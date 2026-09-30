import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

describe('Carrier dashboard CX-reference execution contract', () => {
  const page = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
  const css = read('app/components/workspace/CarrierDashboard.module.css');

  it('uses the CX dashboard management anatomy instead of an operational workboard', () => {
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect(page).toContain('<h1 className={carrierStyles.dashboardTitle}>Carrier Dashboard</h1>');
    expect(css).toMatch(/\.dashboardTitle\s*\{[^}]*width: 1px;[^}]*height: 1px;[^}]*clip-path: inset\(50%\)/);
    expect(page).toContain('title="Reports & Statistics"');
    expect(page).toContain('title="Activity at a glance"');
    expect(page).toContain('title="Accounts Payable"');
    expect(page).toContain('title="Reports"');
    expect(page).toContain('title="Feedback in Last 90 Days"');
    expect(page).toContain('title="Compliance - Drivers & Vehicles"');
    expect(page).not.toContain('Operational workboard');
    expect(page).not.toContain('Carrier workflow');
    expect(page).not.toContain('Control filters');
  });

  it('keeps global navigation in the shell and only contextual dashboard controls', () => {
    for (const duplicateLabel of [
      '>Jobs</ActionButton>',
      '>Live Availability</ActionButton>',
      '>Live Positions</ActionButton>',
      '>Freight Vision</ActionButton>',
      '>Directory</ActionButton>',
      '>Messages</ActionButton>',
      '>Event Log</ActionButton>',
    ]) {
      expect(page).not.toContain(duplicateLabel);
    }
    expect(page).not.toContain("{data.loading ? 'Refreshing…' : 'Refresh'}");
    expect(page).toContain('View all…');
  });

  it('locks the CX-inspired two-column desktop geometry', () => {
    expect(css).toMatch(/\.page\s*\{[\s\S]*?padding:\s*12px 12px 16px;/);
    expect(css).toMatch(/\.cxDashboardGrid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.43fr\) minmax\(0, 0\.57fr\);/);
    expect(css).toMatch(/\.panelHeader\s*\{[\s\S]*?height:\s*36px;/);
    expect(css).toMatch(/\.metricTile\s*\{[\s\S]*?min-height:\s*148px;/);
    expect(css).toContain('grid-template-columns: minmax(0, 1.35fr) minmax(160px, .85fr) minmax(150px, .7fr);');
  });

  it('uses dense CX-like booking cards with contextual actions', () => {
    expect(page).toContain('className={carrierStyles.bookingCard}');
    expect(page).toContain('className={carrierStyles.bookingRoute}');
    expect(page).toContain('className={carrierStyles.bookingTiming}');
    expect(page).toContain('className={carrierStyles.bookingStatus}');
    expect(page).toContain('className={carrierStyles.bookingActions}');
    expect(page).toContain("isUnallocatedJob(job) ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`");
  });
});
