import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('local validation gate while GitHub Actions remain disabled', () => {
  it('does not recreate GitHub Actions workflows', () => {
    const workflows = join(root, '.github', 'workflows');
    expect(existsSync(workflows) ? readdirSync(workflows).filter((name) => /\.ya?ml$/i.test(name)) : []).toEqual([]);
  });

  it('retains the protected local PowerShell gate and production build', () => {
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const gate = readFileSync(join(root, 'scripts', 'verify-protected-workspace-invariants.ps1'), 'utf8');
    const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(agents).toContain('GitHub Actions remain disabled');
    expect(agents).toContain('verify-protected-workspace-invariants.ps1');
    expect(agents).toContain('npm run build');
    expect(gate).toContain('# GitHub Actions must stay disabled.');
    expect(packageJson.scripts.build).toBeTruthy();
  });
});
