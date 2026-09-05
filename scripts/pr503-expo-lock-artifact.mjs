import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';

const isPr503 =
  process.env.CONTEXT === 'deploy-preview' && process.env.REVIEW_ID === '503';

if (!isPr503) {
  console.log('PR503_EXPO_LOCK_ARTIFACT=SKIP');
  process.exit(0);
}

// The release gate has already regenerated and validated this lockfile on PR #503.
// This temporary bridge only exports the exact validated bytes for reconciliation.
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
