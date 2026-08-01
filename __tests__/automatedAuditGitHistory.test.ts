import { describe, expect, it } from 'vitest';

import { GIT_SECRET_HISTORY_PATHS, checkGitSecrets } from '../scripts/run-automated-audit.mjs';

describe('automated audit git history secret scan', () => {
  it('scans the intended history pathspecs', () => {
    const calls: string[][] = [];

    checkGitSecrets((paths) => {
      calls.push(paths);
      return { ok: true, stdout: '', stderr: '', status: 0 };
    });

    expect(calls).toEqual([GIT_SECRET_HISTORY_PATHS]);
    expect(GIT_SECRET_HISTORY_PATHS).toEqual(['*.env', '*.json', '*.ts', '*.js']);
  });

  it('fails closed when the git history command errors', () => {
    const results = checkGitSecrets(() => ({
      ok: false,
      stdout: '',
      stderr: 'fatal: git log failed',
      status: 128,
    }));

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.pass === false)).toBe(true);
    expect(results[0]?.note).toContain('failed closed');
  });
});
