import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/components/workspace/InvoiceRegisterPage.tsx'),
  'utf8',
);

describe('invoice register truthfulness', () => {
  it('does not render a missing invoice amount as £0.00', () => {
    expect(source).toContain("value == null");
    expect(source).toContain("? 'Not supplied'");
    expect(source).not.toContain('format(Number(value ?? 0))');
  });

  it('keeps the shared XDrive job reference in the register', () => {
    expect(source).toContain('XDL-${jobId.slice(0, 8).toUpperCase()}');
  });
});
