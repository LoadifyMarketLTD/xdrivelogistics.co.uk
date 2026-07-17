const fs = require('fs');
const zlib = require('zlib');
const apkPath = 'c:/Users/Danny/OneDrive/Desktop/application-1f49bcee-03ba-4854-ac6f-3e296310aa27.apk';
const buf = fs.readFileSync(apkPath);
function findEocd() {
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const idx = buf.lastIndexOf(sig);
  if (idx === -1) throw new Error('EOCD not found');
  return idx;
}
function getCentralDir() {
  const idx = findEocd();
  const total = buf.readUInt16LE(idx + 10);
  const size = buf.readUInt32LE(idx + 12);
  const offset = buf.readUInt32LE(idx + 16);
  return { total, size, offset };
}
function getEntry(name) {
  const { offset, size } = getCentralDir();
  let off = offset;
  while (off < offset + size) {
    const sig = buf.readUInt32LE(off);
    if (sig !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const entryName = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const localHeaderOffset = buf.readUInt32LE(off + 42);
    if (entryName === name) {
      const lh = localHeaderOffset;
      const fnLen = buf.readUInt16LE(lh + 26);
      const extraLen2 = buf.readUInt16LE(lh + 28);
      const dataStart = lh + 30 + fnLen + extraLen2;
      const compMethod = buf.readUInt16LE(lh + 8);
      const compSize = buf.readUInt32LE(lh + 18);
      const data = buf.slice(dataStart, dataStart + compSize);
      if (compMethod === 0) return data;
      if (compMethod === 8) return zlib.inflateRawSync(data);
      throw new Error('Unsupported compression method ' + compMethod);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
function extractStrings(data) {
  const text = data.toString('latin1');
  const regex = /[\x20-\x7E]{4,}/g;
  const result = [];
  let match;
  while ((match = regex.exec(text))) {
    result.push(match[0]);
  }
  return result;
}
function findInterestingStrings(data) {
  const text = data.toString('latin1');
  const keys = ['supabase', 'apiBaseUrl', 'supabaseAnonKey', 'https://', 'secret', 'token', 'auth', 'password', 'key', 'ANON', 'anon'];
  const hits = new Set();
  for (const key of keys) {
    const re = new RegExp(key + "[^\"'\\s]{0,200}", "gi");
    let m;
    while ((m = re.exec(text))) {
      hits.add(m[0]);
    }
  }
  return Array.from(hits);
}
const manifest = getEntry('AndroidManifest.xml');
if (!manifest) {
  console.error('AndroidManifest.xml not found');
  process.exit(1);
}
console.log('=== AndroidManifest strings ===');
extractStrings(manifest).forEach(s => console.log(s));
const appConfig = getEntry('assets/app.config');
if (appConfig) {
  console.log('=== assets/app.config ===');
  console.log(appConfig.toString('utf8'));
}
const versionInfo = getEntry('META-INF/version-control-info.textproto');
if (versionInfo) {
  console.log('=== META-INF/version-control-info.textproto ===');
  console.log(versionInfo.toString('utf8'));
}
const bundle = getEntry('assets/index.android.bundle');
if (bundle) {
  console.log('=== bundle interesting strings ===');
  findInterestingStrings(bundle).forEach(s => console.log(s));
  console.log('bundle length', bundle.length);
}
const cd = getCentralDir();
console.log('central dir entries', cd.total, 'size', cd.size, 'offset', cd.offset);
