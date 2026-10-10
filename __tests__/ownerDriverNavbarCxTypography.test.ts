import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('app/components/workspace/top-workspace-shell.css', 'utf8');

describe('Owner Driver navbar CX-like typography', () => {
  it('uses the approved readable navbar scale', () => {
    expect(css).toContain('PR675 Owner Driver navbar: CX-like readable density');
    expect(css).toContain('font-size:13px!important');
    expect(css).toContain('line-height:18px!important');
    expect(css).toContain('font-weight:600!important');
    expect(css).toContain('padding:0 13px!important');
  });

  it('keeps the active underline thin and the nav compact', () => {
    expect(css).toContain('box-shadow:inset 0 -2px 0 #1d57d8!important');
    expect(css).toContain('height:42px!important');
  });
});