import fs from 'node:fs';
import path from 'node:path';

describe('CX operational convergence primitives', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

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

  it('keeps CX density content-driven and avoids oversized operational geometry', () => {
    const css = read('app/components/workspace/OperationalConvergence.module.css');

    expect(css).toContain('min-height: 52px;');
    expect(css).toContain('grid-template-columns: minmax(0, 1.9fr) minmax(300px, .75fr);');
    expect(css).toContain('var(--ws-radius, 4px)');
    expect(css).not.toMatch(/height:\s*(129|199|241|255|411)px/);
    expect(css).not.toContain('min-height: 100px;');
  });

  it('stacks the operational workspace at tablet width and retains a two-column signal strip on mobile', () => {
    const css = read('app/components/workspace/OperationalConvergence.module.css');

    expect(css).toMatch(/@media \(max-width: 1024px\)[\s\S]*?\.workspaceGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.signalStrip\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  });
});
