import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('global Diary typography parity', () => {
  const css = read('app/components/workspace/workspace-measured-cx-baseline.css');

  it('promotes the approved Diary 14px interactive typography globally', () => {
    expect(css).toContain('--ws-interactive-font-size: 14px;');
    expect(css).toContain('--ws-interactive-line-height: 18px;');
    expect(css).toContain('--ws-interactive-font-weight: 600;');
    expect(css).toContain('a[href]');
    expect(css).toContain('[role="tab"]');
    expect(css).toContain('[role="menuitem"]');
    expect(css).toContain('label:has(input[type="checkbox"])');
  });

  it('keeps the rule scoped to measured operational workspaces', () => {
    expect(css).toContain('.xdrive-workspace-measured :is(');
    expect(css).not.toContain('.super-admin --ws-interactive-font-size');
  });

  it('keeps selected interactive states visually stronger', () => {
    expect(css).toContain('[aria-current="page"]');
    expect(css).toContain('[aria-selected="true"]');
    expect(css).toContain('font-weight: 700 !important;');
  });
});
