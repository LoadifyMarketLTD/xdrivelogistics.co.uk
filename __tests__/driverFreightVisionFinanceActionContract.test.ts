import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app/driver/freight-vision/page.tsx'), 'utf8');

describe('Driver Freight Vision finance action', () => {
  it('routes Payment Report to Finance instead of rendering a dead disabled control', () => {
    expect(source).toContain("router.push('/driver/finance')");
    expect(source).toContain('Payment Report');
    expect(source).not.toContain('disabled title="Payment Report is handled in Finance"');
  });
});
