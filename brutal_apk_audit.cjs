const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

const apks = [
  'c:/Users/Danny/OneDrive/Desktop/application-1f49bcee-03ba-4854-ac6f-3e296310aa27.apk',
  'c:/Users/Danny/OneDrive/Desktop/application-75825eae-281c-4f1b-9930-f33754c6b474.apk',
  'c:/Users/Danny/OneDrive/Desktop/application-afc349f9-f4d6-46ce-a49c-cae4891cfb66.apk',
  'c:/Users/Danny/OneDrive/Desktop/xdrive-driver-final-preview-0.1.0-1.apk'
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function findEocd(buf) {
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const i = buf.lastIndexOf(sig);
  if (i < 0) throw new Error('EOCD not found');
  return i;
}

function centralDir(buf) {
  const i = findEocd(buf);
  return {
    total: buf.readUInt16LE(i + 10),
    size: buf.readUInt32LE(i + 12),
    offset: buf.readUInt32LE(i + 16)
  };
}

function eachEntry(buf, cb) {
  const cd = centralDir(buf);
  let off = cd.offset;
  while (off < cd.offset + cd.size) {
    const sig = buf.readUInt32LE(off);
    if (sig !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const localHeaderOffset = buf.readUInt32LE(off + 42);
    cb({ name, localHeaderOffset });
    off += 46 + nameLen + extraLen + commentLen;
  }
}

function getEntry(buf, wantedName) {
  let found = null;
  eachEntry(buf, ({ name, localHeaderOffset }) => {
    if (found || name !== wantedName) return;
    const lh = localHeaderOffset;
    const method = buf.readUInt16LE(lh + 8);
    const compSize = buf.readUInt32LE(lh + 18);
    const fnLen = buf.readUInt16LE(lh + 26);
    const exLen = buf.readUInt16LE(lh + 28);
    const start = lh + 30 + fnLen + exLen;
    const compressed = buf.slice(start, start + compSize);
    if (method === 0) found = compressed;
    else if (method === 8) found = zlib.inflateRawSync(compressed);
  });
  return found;
}

function extractDomains(text) {
  const rx = /https?:\/\/[^\s"'<>\\)]+/gi;
  const out = new Set();
  let m;
  while ((m = rx.exec(text))) {
    out.add(m[0]);
  }
  return [...out].sort();
}

function scanSensitive(text) {
  const patterns = {
    service_role: /service_role/gi,
    supabase_anon: /supabaseanonkey|anonkey|anon_key/gi,
    stripe_live: /sk_live_[0-9a-zA-Z]+/g,
    stripe_test: /sk_test_[0-9a-zA-Z]+/g,
    sendgrid: /SG\.[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+/g,
    jwt_like: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g
  };
  const res = {};
  for (const [k, rx] of Object.entries(patterns)) {
    const matches = text.match(rx);
    res[k] = matches ? matches.length : 0;
  }
  return res;
}

function summarize(apkPath) {
  if (!fs.existsSync(apkPath)) {
    return { apkPath, exists: false };
  }
  const stat = fs.statSync(apkPath);
  const buf = fs.readFileSync(apkPath);
  const cd = centralDir(buf);

  const needed = [
    'AndroidManifest.xml',
    'classes.dex',
    'assets/app.config',
    'assets/index.android.bundle',
    'META-INF/com/android/build/gradle/app-metadata.properties'
  ];

  const entries = new Set();
  eachEntry(buf, ({ name }) => entries.add(name));

  const appConfigBuf = getEntry(buf, 'assets/app.config');
  const bundleBuf = getEntry(buf, 'assets/index.android.bundle');
  const manifestBuf = getEntry(buf, 'AndroidManifest.xml');

  let appConfig = null;
  try {
    appConfig = appConfigBuf ? JSON.parse(appConfigBuf.toString('utf8')) : null;
  } catch (_) {}

  const bundleText = bundleBuf ? bundleBuf.toString('latin1') : '';
  const domains = extractDomains(bundleText).slice(0, 80);
  const sensitive = scanSensitive(bundleText);

  return {
    apkPath,
    exists: true,
    bytes: stat.size,
    modified: stat.mtime.toISOString(),
    sha256: sha256(buf),
    zipEntries: cd.total,
    hasNeeded: Object.fromEntries(needed.map(n => [n, entries.has(n)])),
    app: appConfig ? {
      name: appConfig.name,
      slug: appConfig.slug,
      sdkVersion: appConfig.sdkVersion,
      androidPackage: appConfig?.android?.package,
      apiBaseUrl: appConfig?.extra?.apiBaseUrl,
      supabaseUrl: appConfig?.extra?.supabaseUrl,
      easProjectId: appConfig?.extra?.eas?.projectId,
      version: appConfig.version
    } : null,
    bundleSensitiveCounts: sensitive,
    domainSample: domains,
    manifestLooksBinary: manifestBuf ? !manifestBuf.toString('utf8', 0, 30).includes('<manifest') : null
  };
}

const report = apks.map(summarize);
console.log(JSON.stringify(report, null, 2));
