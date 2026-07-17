const fs = require('fs');
const zlib = require('zlib');

const apkPaths = [
  'c:/Users/Danny/OneDrive/Desktop/application-1f49bcee-03ba-4854-ac6f-3e296310aa27.apk',
  'c:/Users/Danny/OneDrive/Desktop/application-75825eae-281c-4f1b-9930-f33754c6b474.apk',
  'c:/Users/Danny/OneDrive/Desktop/application-afc349f9-f4d6-46ce-a49c-cae4891cfb66.apk',
  'c:/Users/Danny/OneDrive/Desktop/DIVERSE/SAMSUNG/New folder 1/Download/netflix-kodi-edition-1.26-en.apk'
];

function getCentralDir(buf) {
  const sig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const idx = buf.lastIndexOf(sig);
  if (idx === -1) throw new Error('EOCD not found');
  return {
    total: buf.readUInt16LE(idx + 10),
    size: buf.readUInt32LE(idx + 12),
    offset: buf.readUInt32LE(idx + 16),
  };
}

function getEntry(buf, name) {
  const cd = getCentralDir(buf);
  let off = cd.offset;
  while (off < cd.offset + cd.size) {
    const entrySig = buf.readUInt32LE(off);
    if (entrySig !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const entryName = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const localHeaderOffset = buf.readUInt32LE(off + 42);
    if (entryName === name) {
      const lh = localHeaderOffset;
      const fnLen = buf.readUInt16LE(lh + 26);
      const exLen = buf.readUInt16LE(lh + 28);
      const dataStart = lh + 30 + fnLen + exLen;
      const compMethod = buf.readUInt16LE(lh + 8);
      const compSize = buf.readUInt32LE(lh + 18);
      const data = buf.slice(dataStart, dataStart + compSize);
      if (compMethod === 0) return data;
      if (compMethod === 8) return zlib.inflateRawSync(data);
      return null;
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

for (const apkPath of apkPaths) {
  const exists = fs.existsSync(apkPath);
  if (!exists) {
    console.log('===', apkPath, '===');
    console.log('MISSING');
    continue;
  }
  const stat = fs.statSync(apkPath);
  const buf = fs.readFileSync(apkPath);
  const appConfigBuf = getEntry(buf, 'assets/app.config');
  const metadataBuf = getEntry(buf, 'META-INF/com/android/build/gradle/app-metadata.properties');
  const bundleBuf = getEntry(buf, 'assets/index.android.bundle');

  console.log('===', apkPath, '===');
  console.log('sizeBytes=', stat.size);
  console.log('mtime=', stat.mtime.toISOString());
  console.log('hasAppConfig=', Boolean(appConfigBuf));
  console.log('hasBundle=', Boolean(bundleBuf));
  if (metadataBuf) {
    console.log('appMetadata=', metadataBuf.toString('utf8').trim().replace(/\r?\n/g, '; '));
  }
  if (appConfigBuf) {
    try {
      const cfg = JSON.parse(appConfigBuf.toString('utf8'));
      console.log('name=', cfg.name || '');
      console.log('slug=', cfg.slug || '');
      console.log('sdkVersion=', cfg.sdkVersion || '');
      console.log('androidPackage=', cfg?.android?.package || '');
      console.log('apiBaseUrl=', cfg?.extra?.apiBaseUrl || '');
      console.log('supabaseUrl=', cfg?.extra?.supabaseUrl || '');
      console.log('projectId=', cfg?.extra?.eas?.projectId || '');
    } catch (err) {
      console.log('appConfigParseError=', String(err.message || err));
    }
  }
}
