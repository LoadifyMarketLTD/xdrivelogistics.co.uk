import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('PR675 Owner Driver reference layering contract', () => {
  it('keeps the Owner Driver reference layers present but editable for CX convergence', () => {
    expect(read('app/driver/page.tsx')).toContain('driver-reference-dashboard');
    expect(read('app/driver/driver-dashboard-reference.css')).toContain('.driver-reference-dashboard');
    expect(read('app/driver/driver-dashboard-cx-close.css')).toContain('.driver-reference-dashboard');
    expect(read('app/driver/driver-dashboard-prototype-exact.css')).toContain('.driver-exact-prototype');
  });

  it('loads the PR675-derived dashboard layers after shared convergence CSS', () => {
    const layout = read('app/driver/layout.tsx');
    const baseline = layout.indexOf("workspace-measured-cx-baseline.css");
    const reference = layout.indexOf("driver-dashboard-reference.css");
    const close = layout.indexOf("driver-dashboard-cx-close.css");
    const exact = layout.indexOf("driver-dashboard-prototype-exact.css");

    expect(baseline).toBeGreaterThan(-1);
    expect(reference).toBeGreaterThan(baseline);
    expect(close).toBeGreaterThan(reference);
    expect(exact).toBeGreaterThan(close);
  });
});
