import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dashboard numeric visual contract', () => {
  it('keeps dashboard titles at the approved 20px/26px hierarchy', () => {
    const css = readFileSync(
      join(process.cwd(), 'app/components/workspace/CarrierDashboard.module.css'),
      'utf8',
    );

    expect(css).toMatch(/\.title\s*\{[\s\S]*?font-size:\s*20px;/);
    expect(css).toMatch(/\.title\s*\{[\s\S]*?line-height:\s*26px;/);
  });

  it('keeps the Carrier dashboard CX-inspired two-column geometry', () => {
    const css = readFileSync(
      join(process.cwd(), 'app/components/workspace/CarrierDashboard.module.css'),
      'utf8',
    );

    expect(css).toContain('grid-template-columns: minmax(0, 0.43fr) minmax(0, 0.57fr);');
    expect(css).toMatch(/\.panelHeader\s*\{[\s\S]*?height:\s*36px;/);
    expect(css).toMatch(/\.reportLink\s*\{[\s\S]*?min-height:\s*46px;/);
  });
});
