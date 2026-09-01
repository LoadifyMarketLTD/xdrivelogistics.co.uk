import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) process.exit(1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_MODIFIED_TESTS');
run(process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs']);
run(npmCommand, ['run', 'typecheck']);
run(npmCommand, [
  'run', 'test:unit', '--',
  '__tests__/availabilityTrackingContract.test.ts',
  '__tests__/cleanReplayProfileLegacyIdContract.test.ts',
  '__tests__/driverMobileJobActionRoute.test.ts',
  '__tests__/driverMobileRequireDriverCompat.test.ts',
  '__tests__/guardianSecurityContractClosure.test.ts',
  '__tests__/jobsStatusTextViewDependencyContract.test.ts',
  '__tests__/ownerAtomicDeleteMigrationContract.test.ts',
  '__tests__/remainingLegacyFleetResolution.test.ts',
  '__tests__/storageObjectPathRlsRepair.test.ts',
  '__tests__/vehicleReadinessPhysicalContract.test.ts',
]);
run(npmCommand, ['run', 'build']);
console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_MODIFIED_TESTS_PASS');
