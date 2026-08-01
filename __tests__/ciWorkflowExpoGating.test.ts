import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('CI workflow Expo gating', () => {
  it('does not allow pull requests to skip Expo typecheck when labels are absent', () => {
    const workflow = readRepoFile('.github/workflows/ci.yml');
    const expoJob = workflow.match(/expo-driver-typecheck:[\s\S]*?codeql:/)?.[0] ?? '';

    expect(expoJob).toContain("github.event_name == 'pull_request'");
    expect(expoJob).not.toContain('scope:expo');
    expect(expoJob).not.toContain('scope:cross');
  });
});
