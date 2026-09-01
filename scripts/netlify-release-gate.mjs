import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, failClosed = true) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    if (failClosed) process.exit(1);
    return 1;
  }
  if (failClosed && result.status !== 0) process.exit(result.status ?? 1);
  return result.status ?? 1;
}

console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_VITEST_REPORT');
run(process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs']);
run(npmCommand, ['run', 'typecheck']);

mkdirSync('public/diagnostics', { recursive: true });
const vitestExit = run(npmCommand, ['run', 'test:unit', '--', '--reporter=json', '--outputFile=public/diagnostics/vitest.json'], false);
console.log(`VITEST_DIAGNOSTIC_EXIT=${vitestExit}`);

run(npmCommand, ['run', 'build']);
console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_REPORT_DEPLOYED');
