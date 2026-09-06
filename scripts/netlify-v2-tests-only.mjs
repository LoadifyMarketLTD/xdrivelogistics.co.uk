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
const runVisible = (args) => {
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
};

let report = { head: process.env.COMMIT_REF ?? null, test: null, status: 0, stdout: '', stderr: '' };
for (const test of tests) {
  const result = runCaptured(['run', 'test:unit', '--', test]);
  if (result.error || result.status !== 0) {
    report = {
      head: process.env.COMMIT_REF ?? null,
      test,
      status: result.status ?? -1,
      stdout: tail(result.stdout),
      stderr: tail(result.stderr ?? result.error?.message),
    };
    break;
  }
}

mkdirSync('public', { recursive: true });
writeFileSync('public/__v2-test-diagnostic.json', JSON.stringify(report, null, 2));
console.log(`NETLIFY_V2_TEST_DIAGNOSTIC=${report.test ?? 'ALL_PASS'}:${report.status}`);

runVisible(['run', 'typecheck']);
runVisible(['run', 'build']);
