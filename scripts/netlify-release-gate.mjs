import { spawnSync } from 'node:child_process';

console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_MIGRATION_ONLY');

const result = spawnSync(process.execPath, ['.github/scripts/validate-supabase-migration-files.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, CI: process.env.CI ?? 'true' },
  stdio: 'inherit',
  shell: false,
});

if (result.error) process.exit(1);
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('NETLIFY_RELEASE_GATE=DIAGNOSTIC_MIGRATION_PASS');
