import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = ['app', 'lib'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const mojibake = [
  '\u00e2\u20ac\u00a6',
  '\u00e2\u20ac\u201d',
  '\u00e2\u20ac\u201c',
  '\u00e2\u20ac\u00a2',
  '\u00c2\u00b7',
  '\u00c3\u2014',
  '\u00f0\u0178',
  '\u00ef\u00bf\u00bd',
  '\uFFFD',
];

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(target));
    else if (extensions.has(path.extname(entry.name))) out.push(target);
  }
  return out;
}

describe('runtime source encoding sanity', () => {
  it('contains no known UTF-8 mojibake sequences', () => {
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of sourceFiles(path.join(process.cwd(), root))) {
        const source = fs.readFileSync(file, 'utf8');
        const hits = mojibake.filter((token) => source.includes(token));
        if (hits.length) offenders.push(path.relative(process.cwd(), file) + ': ' + hits.map((token) => JSON.stringify(token)).join(', '));
      }
    }
    expect(offenders).toEqual([]);
  });
});