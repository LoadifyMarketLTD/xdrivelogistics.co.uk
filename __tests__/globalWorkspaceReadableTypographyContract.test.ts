import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/workspace-measured-cx-baseline.css'), 'utf8');

describe('global workspace readable typography hard lock', () => {
  it('sets Diary readability tokens as the operational workspace minimum', () => {
    expect(css).toContain('--ws-font-body: 14px;');
    expect(css).toContain('--ws-font-label: 14px;');
    expect(css).toContain('--ws-font-meta: 14px;');
    expect(css).toContain('--ws-font-micro: 14px;');
  });

  it('covers operational content as well as interactive controls', () => {
    for (const selector of ['p,', 'span,', 'small,', 'th,', 'td,', 'a,', 'button,', 'select,']) {
      expect(css).toContain(selector);
    }
    expect(css).toContain('font-size: 14px !important;');
    expect(css).toContain('line-height: 18px !important;');
  });

  it('keeps key operational titles stronger at 16px', () => {
    expect(css).toContain('.workspace-record-title');
    expect(css).toContain('font-size: 16px !important;');
    expect(css).toContain('line-height: 20px !important;');
  });
});
