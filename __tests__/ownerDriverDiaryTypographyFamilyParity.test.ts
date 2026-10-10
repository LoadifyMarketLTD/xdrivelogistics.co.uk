import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('app/driver/history/diary-exchange.css','utf8');

describe('Owner Driver Diary typography matches Loads',()=>{
  it('uses the same Segoe UI family as Loads',()=>{
    expect(css).toContain('PR675 Diary: exact typographic family parity with Loads');
    expect(css).toContain('font-family:"Segoe UI",Arial,sans-serif!important');
  });
  it('pins labels, primary values, metadata and actions to the approved weights',()=>{
    expect(css).toContain('font-size:10.8px!important');
    expect(css).toContain('font-weight:450!important');
    expect(css).toContain('font-size:12px!important');
    expect(css).toContain('font-weight:600!important');
    expect(css).toContain('font-size:10px!important');
    expect(css).toContain('font-weight:400!important');
    expect(css).toContain('font-size:10.5px!important');
    expect(css).toContain('font-weight:500!important');
  });
});