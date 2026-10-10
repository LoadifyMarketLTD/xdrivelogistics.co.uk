import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('app/driver/history/diary-exchange.css','utf8');

describe('Diary collapsed card geometry matches Loads family',()=>{
  it('pins the same core body/footer heights',()=>{
    expect(css).toContain('PR675 Diary collapsed-card geometry: exact Loads family parity');
    expect(css).toContain('min-height:82px!important');
    expect(css).toContain('height:28px!important');
    expect(css).toContain('height:27px!important');
  });
  it('keeps labels and values inline in the top row',()=>{
    expect(css).toContain('.driver-diary-entry__top .driver-cell-label');
    expect(css).toContain('display:inline!important');
    expect(css).toContain('.driver-diary-entry__top .driver-cell-primary');
  });
});