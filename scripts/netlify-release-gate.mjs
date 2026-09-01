import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Canonical no-GitHub-hosted-runner gate.
// Netlify is the CI runner for repository validation. Database behavior/security
// remains validated by Supabase Preview; this gate fails closed before deploy on
// migration integrity, TypeScript, unit tests, and the production Next.js build.
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
  {
    label: 'Vitest unit suite',
    command: npmCommand,
    args: ['run', 'test:unit'],
  },
  {
    label: 'Next.js production build',
    command: npmCommand,
    args: ['run', 'build'],
  },
];

console.log('NETLIFY_RELEASE_GATE=START');
console.log('NETLIFY_RELEASE_GATE_RUNNER=NETLIFY');
console.log('GITHUB_ACTIONS_REQUIRED=false');

for (const gate of gates) {
  console.log(`\n=== ${gate.label} ===`);
  const result = spawnSync(gate.command, gate.args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`NETLIFY_RELEASE_GATE=FAIL gate=${JSON.stringify(gate.label)} reason=${JSON.stringify(result.error.message)}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`NETLIFY_RELEASE_GATE=FAIL gate=${JSON.stringify(gate.label)} exit=${result.status ?? 'null'}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nNETLIFY_RELEASE_GATE=PASS');
