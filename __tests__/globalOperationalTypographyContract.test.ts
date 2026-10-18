import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const OPERATIONAL_DIRS = [
  'app/admin',
  'app/broker',
  'app/customer',
  'app/driver',
  'app/components/workspace',
];

const SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx']);

function walk(relativeDir: string): string[] {
  const absolute = path.join(ROOT, relativeDir);
  const out: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name);
    if (relative.includes(`${path.sep}super-admin${path.sep}`)) continue;
    if (entry.isDirectory()) out.push(...walk(relative));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(relative);
  }
  return out;
}

describe('canonical global operational typography', () => {
  const baseline = fs.readFileSync(
    path.join(ROOT, 'app/components/workspace/workspace-measured-cx-baseline.css'),
    'utf8',
  );

  it('owns the approved 14/16/20 typography tokens in the shared measured shell', () => {
    expect(baseline).toContain('--ws-font-page-title: 20px;');
    expect(baseline).toContain('--ws-font-section-title: 16px;');
    expect(baseline).toContain('--ws-font-panel-title: 16px;');
    expect(baseline).toContain('--ws-font-body: 14px;');
    expect(baseline).toContain('--ws-font-label: 14px;');
    expect(baseline).toContain('--ws-font-meta: 14px;');
    expect(baseline).toContain('--ws-font-micro: 14px;');
    expect(baseline).toContain('--ws-interactive-font-size: 14px;');
    expect(baseline).toContain('--ws-interactive-line-height: 18px;');
    expect(baseline).toContain('--ws-interactive-font-weight: 600;');
  });

  it('rejects pre-canonical 10px–13px operational font sizes outside the navbar exception', () => {
    const violations: string[] = [];
    const fontSize = /font-size\s*:\s*(?:10(?:\.\d+)?|11(?:\.\d+)?|12(?:\.\d+)?|13(?:\.\d+)?)px/gi;
    const inlineFontSize = /fontSize\s*:\s*['"](?:10(?:\.\d+)?|11(?:\.\d+)?|12(?:\.\d+)?|13(?:\.\d+)?)px['"]/gi;
    const oldToken = /--ws-font-(?:body|label|meta|micro)\s*:\s*(?:10|11|12|13)px/gi;
    const oldFallback = /var\(--ws-font-(?:body|label|meta|micro),\s*(?:10|11|12|13)(?:\.\d+)?px\)/gi;
    const oldTitleFallback = /var\(--ws-font-(?:panel-title|section-title),\s*13(?:\.\d+)?px\)/gi;

    for (const file of OPERATIONAL_DIRS.flatMap(walk)) {
      if (file.endsWith(path.join('app', 'components', 'workspace', 'top-workspace-shell.css'))) continue;
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const regex of [fontSize, inlineFontSize, oldToken, oldFallback, oldTitleFallback]) {
        regex.lastIndex = 0;
        if (regex.test(source)) violations.push(file);
      }
    }

    expect([...new Set(violations)]).toEqual([]);
  });

  it('preserves the separately measured 13px navbar exception', () => {
    const shell = fs.readFileSync(
      path.join(ROOT, 'app/components/workspace/top-workspace-shell.css'),
      'utf8',
    );
    expect(shell).toContain('font-size: 13px !important;');
    expect(shell).toContain('font-weight: 600 !important;');
  });
});
