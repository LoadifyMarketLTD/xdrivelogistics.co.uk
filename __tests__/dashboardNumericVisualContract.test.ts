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

  it('reflows Carrier signals without a forced horizontal scroll surface', () => {
    const component = readFileSync(
      join(process.cwd(), 'app/components/workspace/CarrierOperationsDashboardHome.tsx'),
      'utf8',
    );
    const css = readFileSync(
      join(process.cwd(), 'app/components/workspace/WorkspaceUI.module.css'),
      'utf8',
    );

    expect(component).toContain('className={styles.carrierControlSignalsGrid}');
    expect(component).not.toContain("minWidth: '780px'");
    expect(css).toContain('.carrierControlSignalsGrid');
    expect(css).toContain('grid-template-columns: repeat(6, minmax(0, 1fr))');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });
});
