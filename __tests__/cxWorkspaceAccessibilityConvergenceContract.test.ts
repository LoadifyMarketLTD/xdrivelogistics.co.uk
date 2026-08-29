import fs from 'node:fs';
import path from 'node:path';

describe('CX workspace accessibility convergence', () => {
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('uses semantic buttons and accessible labels for shared interactive signals', () => {
    const source = read('app/components/workspace/OperationalConvergence.tsx');
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-label={item.ariaLabel ?? item.label}');
    expect(source).toContain('aria-label={asideLabel}');
    expect(source).toContain('aria-label={controlLabel}');
  });

  it('provides a visible keyboard focus state for shared signal controls', () => {
    const css = read('app/components/workspace/OperationalConvergence.module.css');
    expect(css).toContain('.signalButton:focus-visible');
    expect(css).toContain('outline: 2px solid var(--ws-blue, #1d57d8);');
  });

  it('keeps carrier work views as semantic tabs with selected state', () => {
    const source = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('aria-selected={selected}');
  });

  it('keeps driver operational actions as real buttons and textual status labels', () => {
    const source = read('app/driver/page.tsx');
    expect(source).toContain('<ActionButton');
    expect(source).toContain('<StatusBadge');
    expect(source).toContain('<strong>Next action:</strong>');
  });

  it('keeps customer Action Centre controls as semantic buttons', () => {
    const source = read('app/customer/CustomerDashboardHome.tsx');
    expect(source).toContain('className="customer-attention-row"');
    expect(source).toContain('type="button"');
  });
});
