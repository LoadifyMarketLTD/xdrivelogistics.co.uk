import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shellCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/top-workspace-shell.css'), 'utf8');
const workspaceCss = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/WorkspaceUI.module.css'), 'utf8');

describe('workspace readability contract', () => {
  it('keeps the approved carrier navbar readable without changing its information architecture', () => {
    expect(shellCss).toContain('height: 62px !important;');
    expect(shellCss).toContain('font-size: 14px !important;');
    expect(shellCss).toContain('font-weight: 650 !important;');
    expect(shellCss).toContain('justify-content: space-between !important;');
    expect(shellCss).toContain('box-shadow: inset 0 -3px 0 #1d57d8 !important;');
  });

  it('spreads Jobs status tabs across the desktop row with stronger typography', () => {
    expect(workspaceCss).toContain('grid-template-columns: repeat(8, minmax(84px, 1fr));');
    expect(workspaceCss).toContain('min-height: 44px;');
    expect(workspaceCss).toContain('font-size: 14px;');
    expect(workspaceCss).toContain('font-weight: 650;');
    expect(workspaceCss).toContain('border-bottom: 3px solid transparent;');
  });

  it('keeps narrow viewports usable with horizontally scrollable status tabs', () => {
    expect(workspaceCss).toContain('overflow-x: auto;');
    expect(workspaceCss).toContain('flex-wrap: nowrap;');
  });
});