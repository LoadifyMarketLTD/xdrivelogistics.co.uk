import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dashboard numeric visual contract', () => {
  it('keeps dashboard titles at the approved 20px/26px/600 hierarchy', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/components/workspace/DashboardHomePrimitives.tsx'),
      'utf8',
    );

    expect(source).toContain("fontSize: '20px'");
    expect(source).toContain("lineHeight: '26px'");
    expect(source).toContain('fontWeight: 600');
  });

  it('reflows Carrier signals in the same two-column dashboard family as Owner Driver', () => {
    const component = readFileSync(
      join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
      'utf8',
    );
    const baseline = readFileSync(
      join(process.cwd(), 'app/components/workspace/workspace-measured-cx-baseline.css'),
      'utf8',
    );

    expect(component).toContain('<OperationalSignalStrip ariaLabel="Carrier control signals" items={signals} />');
    expect(component).not.toContain("minWidth: '780px'");
    expect(baseline).toContain('.xdrive-owner-dashboard-grid .xdrive-operational-dashboard-signals');
    expect(baseline).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(baseline).toContain('--ws-dashboard-stat-h: 106px;');
    expect(baseline).toContain('[aria-pressed="true"]');
  });
});
