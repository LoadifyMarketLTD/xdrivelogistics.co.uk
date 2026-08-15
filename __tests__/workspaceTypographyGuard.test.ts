import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = [
  'app/components/workspace',
  'app/customer',
  'app/broker',
  'app/driver',
  'app/admin/fleet',
];

function filesUnder(relative: string): string[] {
  const absolute = path.join(process.cwd(), relative);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? filesUnder(child) : /\.(tsx|ts|css)$/.test(entry.name) ? [child] : [];
  });
}

describe('workspace operational typography', () => {
  it('does not introduce 8–9px operational text in redesigned workspace sources', () => {
    const violations: string[] = [];
    for (const file of roots.flatMap(filesUnder)) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      if (/font(?:-size|Size)\s*[:=]\s*['"]?(?:8|8\.5|9)px\b/i.test(source)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
