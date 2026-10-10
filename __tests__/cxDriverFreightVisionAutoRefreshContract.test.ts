import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/driver/freight-vision/page.tsx'), 'utf8');

describe('CX Driver Freight Vision live refresh parity', () => {
  it('refreshes the assigned-job register only while visible through the shared guarded refresh scheduler', () => {
    expect(source).toContain('useVisibleRefresh');
    expect(source).toContain('intervalMs: 30_000');
    expect(source).toContain('refreshInFlightRef.current');
    expect(source).toContain("load({ background: true })");
    expect(source).not.toContain('window.setInterval');
  });
  it('filters the operational board from its KPI controls and uses the shared lifecycle vocabulary', () => {
    expect(source).toContain("const [riskFilter, setRiskFilter]");
    expect(source).toContain("setRiskFilter('on_time')");
    expect(source).toContain("setRiskFilter('at_risk')");
    expect(source).toContain("setRiskFilter('late')");
    expect(source).toContain("setRiskFilter('untracked')");
    expect(source).toContain('workspaceJobOperationalLabel(job)');
  });});
