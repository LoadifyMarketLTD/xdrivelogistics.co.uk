import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const isPr503 =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '503';

if (!isPr503) {
  console.log('PR503_EXPO_LOCK_ARTIFACT=SKIP');
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('PR503_EXPO_LOCK_ARTIFACT=GENERATE');
run(npmCommand, [
  '--prefix', 'apps/driver-mobile',
  'install',
  '--package-lock-only',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
]);

console.log('PR503_EXPO_LOCK_ARTIFACT=NPM_CI');
run(npmCommand, [
  '--prefix', 'apps/driver-mobile',
  'ci',
  '--no-audit',
  '--no-fund',
]);

console.log('PR503_EXPO_LOCK_ARTIFACT=TYPECHECK');
run(npmCommand, ['--prefix', 'apps/driver-mobile', 'run', 'typecheck']);

console.log('PR503_EXPO_LOCK_ARTIFACT=TESTS');
run(npmCommand, ['--prefix', 'apps/driver-mobile', 'run', 'test']);

console.log('PR503_EXPO_LOCK_ARTIFACT=ANDROID_BUNDLE');
run(npmCommand, ['--prefix', 'apps/driver-mobile', 'run', 'bundle:android']);

const source = resolve('apps/driver-mobile/package-lock.json');
const destination = resolve('public/__pr503/package-lock.generated.json');
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);

const lockBytes = readFileSync(source);
const encoded = gzipSync(lockBytes, { level: 9 }).toString('base64');
const chunkSize = 20_000;
const chunks = [];
for (let offset = 0; offset < encoded.length; offset += chunkSize) {
  chunks.push(encoded.slice(offset, offset + chunkSize));
}

const bridgeUrl = 'https://deploy-preview-503--xdrivelogistics.netlify.app/__pr503/lock-bridge.html';
const commit = process.env.COMMIT_REF ?? 'unknown';
console.log(`PR503_EXPO_LOCK_ARTIFACT=EXPORT parts=${chunks.length}`);
for (let index = 0; index < chunks.length; index += 1) {
  const body = new URLSearchParams({
    'form-name': 'pr503-lock-artifact',
    commit,
    part: String(index + 1),
    total: String(chunks.length),
    data: chunks[index],
  });
  const response = await fetch(bridgeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`PR503 lock bridge rejected part ${index + 1}/${chunks.length}: HTTP ${response.status}`);
  }
}
console.log('PR503_EXPO_LOCK_ARTIFACT=READY');
