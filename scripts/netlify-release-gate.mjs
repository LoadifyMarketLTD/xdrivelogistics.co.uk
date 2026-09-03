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

console.log('NETLIFY_RELEASE_GATE=TYPECHECK_ISOLATION');
run(process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs']);
run(npmCommand, ['run', 'typecheck']);
console.log('NETLIFY_RELEASE_GATE=TYPECHECK_ISOLATION_PASS');
