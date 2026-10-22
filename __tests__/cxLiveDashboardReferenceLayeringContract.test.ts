import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Courier Exchange live dashboard layering contract', () => {
  it('keeps legacy Driver styling layers subordinate to CX live convergence', () => {
    expect(read('app/driver/page.tsx')).toContain('driver-reference-dashboard');
    expect(read('app/driver/driver-dashboard-reference.css')).toContain('.driver-reference-dashboard');
    expect(read('app/driver/driver-dashboard-cx-close.css')).toContain('.driver-reference-dashboard');
    expect(read('app/driver/driver-dashboard-prototype-exact.css')).toContain('.driver-exact-prototype');
  });

  it('keeps legacy dashboard layers present while the shared CX-live seven-workspace contract wins final geometry', () => {
    const layout = read('app/driver/layout.tsx');
    const baseline = layout.indexOf("workspace-measured-cx-baseline.css");
    const reference = layout.indexOf("driver-dashboard-reference.css");
    const close = layout.indexOf("driver-dashboard-cx-close.css");
    const exact = layout.indexOf("driver-dashboard-prototype-exact.css");

    expect(reference).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(reference);
    expect(exact).toBeGreaterThan(close);
    expect(baseline).toBeGreaterThan(exact);
  });
});
