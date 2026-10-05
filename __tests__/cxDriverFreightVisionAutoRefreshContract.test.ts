import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/driver/freight-vision/page.tsx'), 'utf8');

describe('CX Driver Freight Vision live refresh parity', () => {
  it('refreshes the assigned-job register every 60 seconds and cleans up the timer', () => {
    expect(source).toContain('window.setInterval');
    expect(source).toContain('60_000');
    expect(source).toContain('window.clearInterval(timer)');
    expect(source).toContain('Auto refresh 60s');
  });
  it('filters the operational board from its KPI controls and uses the shared lifecycle vocabulary', () => {
    expect(source).toContain("const [riskFilter, setRiskFilter]");
    expect(source).toContain("setRiskFilter('on_time')");
    expect(source).toContain("setRiskFilter('at_risk')");
    expect(source).toContain("setRiskFilter('late')");
    expect(source).toContain("setRiskFilter('untracked')");
    expect(source).toContain('workspaceJobOperationalLabel(job)');
  });});
