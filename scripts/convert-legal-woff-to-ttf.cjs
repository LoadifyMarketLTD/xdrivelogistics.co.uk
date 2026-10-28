const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const base = path.join(path.resolve(__dirname, '..'), 'node_modules', '@fontsource', 'inter', 'files');
const dest = path.join(path.resolve(__dirname, '..'), 'public', 'fonts', 'legal');
fs.mkdirSync(dest, { recursive: true });
function convert(input, output) {
  const w = fs.readFileSync(input);
  if (w.toString('ascii', 0, 4) !== 'wOFF') throw new Error('Invalid WOFF');
  const count = w.readUInt16BE(12);
  const sfntSize = w.readUInt32BE(16);
  const out = Buffer.alloc(sfntSize);
  out.writeUInt32BE(w.readUInt32BE(4), 0);
  out.writeUInt16BE(count, 4);
  const power = 2 ** Math.floor(Math.log2(count));
  out.writeUInt16BE(power * 16, 6);
  out.writeUInt16BE(Math.log2(power), 8);
  out.writeUInt16BE(count * 16 - power * 16, 10);
  let cursor = 12 + count * 16;
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20;
    const tag = w.toString('ascii', entry, entry + 4);
    const start = w.readUInt32BE(entry + 4);
    const compressed = w.readUInt32BE(entry + 8);
    const original = w.readUInt32BE(entry + 12);
    const checksum = w.readUInt32BE(entry + 16);
    const bytes = w.subarray(start, start + compressed);
    const data = compressed < original ? zlib.inflateSync(bytes) : bytes;
    if (data.length !== original) throw new Error('Invalid WOFF table: ' + tag);
    out.write(tag, 12 + i * 16, 4, 'ascii');
    out.writeUInt32BE(checksum, 12 + i * 16 + 4);
    out.writeUInt32BE(cursor, 12 + i * 16 + 8);
    out.writeUInt32BE(original, 12 + i * 16 + 12);
    data.copy(out, cursor);
    cursor = (cursor + original + 3) & ~3;
  }
  if (cursor > out.length) throw new Error('Invalid SFNT length');
  fs.writeFileSync(output, out);
  console.log(output, out.length);
}
for (const weight of [400, 700]) {
  convert(path.join(base, `inter-latin-ext-${weight}-normal.woff`), path.join(dest, `inter-latin-ext-${weight}-normal.ttf`));
}
