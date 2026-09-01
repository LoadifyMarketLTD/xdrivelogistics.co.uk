import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const gates = [
  {
    label: 'Supabase migration filename and encoding validation',
    command: process.execPath,
    args: ['.github/scripts/validate-supabase-migration-files.mjs'],
  },
  {
    label: 'TypeScript typecheck',
    command: npmCommand,
    args: ['run', 'typecheck'],
  },
];

console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_TYPECHECK');

for (const gate of gates) {
  console.log(`\n=== ${gate.label} ===`);
  const result = spawnSync(gate.command, gate.args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) process.exit(1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\nNETLIFY_RELEASE_GATE=DIAGNOSTIC_TYPECHECK_PASS');
