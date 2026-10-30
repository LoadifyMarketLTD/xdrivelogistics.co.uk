import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Canonical Driver PWA UI isolation', () => {
  it('does not import or redirect canonical screens into retired Driver PWA shells', () => {
    const root = resolve(__dirname, '..');
    const result = execFileSync(process.execPath, [resolve(root, 'automation/tests/guard-canonical-driver-pwa.cjs')], { cwd: root, encoding: 'utf8' });
    expect(result).toContain('CANONICAL DRIVER PWA GUARD PASS');
  });
});
