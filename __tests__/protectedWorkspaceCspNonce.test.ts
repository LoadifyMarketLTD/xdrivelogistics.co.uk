import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const protectedLayouts = [
  'app/admin/layout.tsx',
  'app/customer/layout.tsx',
  'app/broker/layout.tsx',
  'app/driver/layout.tsx',
  'app/super-admin/layout.tsx',
] as const;

describe('protected workspace CSP nonce rendering', () => {
  it('forces every protected workspace document to render dynamically', () => {
    for (const path of protectedLayouts) {
      expect(source(path), path).toContain("export const dynamic = 'force-dynamic'");
    }
  });
});
