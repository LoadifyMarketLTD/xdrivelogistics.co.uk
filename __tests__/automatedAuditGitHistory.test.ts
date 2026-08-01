import { describe, expect, it } from 'vitest';

import { GIT_SECRET_HISTORY_PATHS, checkGitSecrets } from '../scripts/run-automated-audit.mjs';

describe('automated audit git history secret scan', () => {
  it('scans the intended history pathspecs', () => {
    const calls: Array<{ paths: string[] | undefined; pattern: string | undefined }> = [];

    checkGitSecrets((paths, pattern) => {
      calls.push({ paths, pattern });
      return { ok: true, stdout: '', stderr: '', status: 0 };
    });

    expect(calls).toEqual([
      { paths: GIT_SECRET_HISTORY_PATHS, pattern: 'service_role' },
      { paths: GIT_SECRET_HISTORY_PATHS, pattern: 'eyJ' },
    ]);
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
