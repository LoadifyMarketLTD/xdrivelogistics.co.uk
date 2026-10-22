import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app/driver/freight-vision/page.tsx'), 'utf8');

describe('Driver Freight Vision finance action', () => {
  it('keeps Freight Vision operational and leaves payment reporting inside Finance', () => {
    expect(source).not.toContain("router.push('/driver/finance')");
    expect(source).not.toContain('Payment Report');
    expect(source).not.toContain('disabled title="Payment Report is handled in Finance"');
  });
});
