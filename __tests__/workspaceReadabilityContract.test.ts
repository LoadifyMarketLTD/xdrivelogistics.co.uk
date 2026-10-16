import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const measuredCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/workspace-measured-cx-baseline.css'), 'utf8');
const workspaceCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceUI.module.css'), 'utf8');
const shellCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/top-workspace-shell.css'), 'utf8');

describe('workspace readability contract', () => {
  it('keeps the canonical operational navbar on the measured Courier Exchange live geometry', () => {
    expect(measuredCss).toContain('--ws-nav-h: 42px;');
    expect(shellCss).toContain('height: 42px !important;');
    expect(shellCss).toContain('padding: 0 13px !important;');
    expect(shellCss).toContain('font-size: 13px !important;');
    expect(shellCss).toContain('font-weight: 600 !important;');
    expect(shellCss).toContain('box-shadow: inset 0 -2px 0 #1d57d8 !important;');
  });

  it('spreads Jobs status tabs across the desktop row with the canonical compact typography', () => {
    expect(workspaceCss).toContain('grid-template-columns: repeat(8, minmax(84px, 1fr));');
    expect(workspaceCss).toContain('min-height: var(--ws-tab-h, 28px);');
    expect(workspaceCss).toContain('font-size: var(--ws-font-body, 12px);');
    expect(workspaceCss).toContain('font-weight: 600;');
    expect(workspaceCss).toContain('border-bottom: 2px solid transparent;');
  });

  it('keeps narrow viewports usable with horizontally scrollable status tabs', () => {
    expect(workspaceCss).toContain('overflow-x: auto;');
    expect(workspaceCss).toContain('flex-wrap: nowrap;');
  });

  it('does not force native upload, range, colour or action inputs into text-field geometry', () => {
    const selector = '.xdrive-workspace-measured input:not(';
    expect(measuredCss.split(selector).length - 1).toBe(2);
    for (const kind of ['file', 'range', 'color', 'hidden', 'button', 'submit', 'reset']) {
      expect(measuredCss).toContain(`[type="${kind}"]`);
    }
  });

  it('reuses the working Jobs tab family for the Driver Diary status strip', () => {
    const diary = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');
    expect(diary).toContain('workspaceStyles.jobsStatusTabs');
    expect(diary).toContain('workspaceStyles.jobsStatusTabActive');
    expect(diary).toContain('workspace-tab-strip');
    expect(diary).toContain('aria-selected={statusFilter === item.id}');
  });
});
