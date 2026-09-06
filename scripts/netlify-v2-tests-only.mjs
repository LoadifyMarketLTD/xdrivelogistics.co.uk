import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tests = [
  '__tests__/superAdminControlPlaneCompleteness.test.ts',
  '__tests__/superAdminMasterV2Contract.test.ts',
  '__tests__/superAdminNavbarContract.test.ts',
  '__tests__/superAdminPlatformHealth.test.ts',
  '__tests__/superAdminVisualContract.test.ts',
  '__tests__/invoiceStatusCanonical.test.ts',
  '__tests__/superAdminStatsContract.test.ts',
  '__tests__/commandCentreMetrics.test.ts',
];

const tail = (value) => String(value ?? '').slice(-16000);
const runCaptured = (args) => spawnSync(npmCommand, args, {
  cwd: process.cwd(),
  env: { ...process.env, CI: process.env.CI ?? 'true' },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
  maxBuffer: 24 * 1024 * 1024,
});

const results = [];
for (const test of tests) {
  const result = runCaptured(['run', 'test:unit', '--', test]);
  results.push({
    test,
    status: result.status ?? (result.error ? -1 : 0),
    stdout: result.status === 0 && !result.error ? '' : tail(result.stdout),
    stderr: result.status === 0 && !result.error ? '' : tail(result.stderr ?? result.error?.message),
  });
}

const failures = results.filter((result) => result.status !== 0);
const report = {
  head: process.env.COMMIT_REF ?? null,
  allPass: failures.length === 0,
  failures,
  results: results.map(({ test, status }) => ({ test, status })),
};

mkdirSync('public', { recursive: true });
writeFileSync('public/__v2-test-diagnostic.json', JSON.stringify(report, null, 2));
console.log(`NETLIFY_V2_TEST_DIAGNOSTIC=${failures.length === 0 ? 'ALL_PASS' : `${failures.length}_FAILURES`}`);
