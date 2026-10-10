import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell = readFileSync('app/components/workspace/TopWorkspaceShell.tsx','utf8');
const css = readFileSync('app/components/workspace/top-workspace-shell.css','utf8');

describe('Diary primary nav hard parity with Loads',()=>{
  it('marks Diary as an explicit workspace surface',()=>{
    expect(shell).toContain("data-workspace-surface={pathname?.startsWith('/driver/history') ? 'diary'");
  });
  it('pins Diary nav to approved dimensions',()=>{
    expect(css).toContain("data-workspace-surface='diary'");
    expect(css).toContain('font-size:13px!important');
    expect(css).toContain('font-weight:600!important');
    expect(css).toContain('line-height:18px!important');
    expect(css).toContain('padding:0 13px!important');
    expect(css).toContain('height:42px!important');
    expect(css).toContain('box-shadow:inset 0 -2px 0 #1d57d8!important');
  });
  it('keeps responsive floor at 12.5px',()=>{
    expect(css).toContain('font-size:12.5px!important');
  });
});