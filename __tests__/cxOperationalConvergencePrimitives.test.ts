import fs from 'node:fs';
import path from 'node:path';

describe('CX operational convergence primitives', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8').replace(/\r\n/g, '\n');

  it('provides the agreed shared operational primitives', () => {
    const source = read('app/components/workspace/OperationalConvergence.tsx');

    for (const primitive of [
      'OperationalSignalStrip',
      'OperationalWorkspaceGrid',
      'OperationalAttentionRail',
      'OperationalAttentionItem',
      'OperationalRecord',
      'OperationalActionRail',
    ]) {
      expect(source).toContain(`export function ${primitive}`);
    }
  });

  it('keeps CX density content-driven and delegates dashboard geometry to the shared Owner Driver grid', () => {
    const source = read('app/components/workspace/OperationalConvergence.tsx');
    const css = read('app/components/workspace/OperationalConvergence.module.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');

    expect(source).toContain('className="xdrive-owner-dashboard-grid"');
    expect(baseline).toContain('grid-template-columns: minmax(360px, var(--ws-dashboard-left-col)) minmax(0, var(--ws-dashboard-right-col));');
    expect(css).toContain('min-height: 52px;');
    expect(css).toContain('var(--ws-radius, 4px)');
    expect(css).not.toMatch(/height:\s*(129|199|241|255|411)px/);
    expect(css).not.toContain('min-height: 100px;');
  });

  it('stacks shared dashboard and control grids responsively and retains a two-column signal strip on mobile', () => {
    const css = read('app/components/workspace/OperationalConvergence.module.css');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');

    expect(baseline).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.xdrive-owner-dashboard-grid[\s\S]*?grid-template-columns:\s*1fr/);
    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.controlGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.signalStrip\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  });
});
