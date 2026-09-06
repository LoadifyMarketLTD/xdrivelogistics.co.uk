import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, failureCode) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error || result.status !== 0) process.exit(failureCode);
}

console.log('NETLIFY_V2_DIAGNOSTIC=TYPECHECK_START');
run(npmCommand, ['run', 'typecheck'], 43);
console.log('NETLIFY_V2_DIAGNOSTIC=TYPECHECK_PASS');

const gate = spawnSync(process.execPath, ['./scripts/netlify-release-gate.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, CI: process.env.CI ?? 'true' },
  stdio: 'inherit',
  shell: false,
});

if (gate.error) process.exit(49);
process.exit(gate.status ?? 49);
