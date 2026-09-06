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

function run(args) {
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}

run(['run', 'test:unit', '--', ...tests]);
run(['run', 'typecheck']);
run(['run', 'build']);
