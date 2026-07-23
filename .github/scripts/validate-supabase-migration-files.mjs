import { promises as fs } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');
const entries = (await fs.readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'en'));

const versions = new Map();
const invalidNames = [];
const bomFiles = [];

for (const fileName of entries) {
  const separator = fileName.indexOf('_');
  const version = separator === -1 ? '' : fileName.slice(0, separator);

  if (!/^\d+$/.test(version)) {
    invalidNames.push(fileName);
  } else {
    const files = versions.get(version) ?? [];
    files.push(fileName);
    versions.set(version, files);
  }

  const bytes = await fs.readFile(path.join(migrationsDir, fileName));
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bomFiles.push(fileName);
  }
}

const duplicates = [...versions.entries()]
  .filter(([, files]) => files.length > 1)
  .sort(([left], [right]) => left.localeCompare(right, 'en'));

console.log(`Migration files scanned: ${entries.length}`);
console.log(`Unique migration versions: ${versions.size}`);

if (duplicates.length > 0) {
  console.error('\nDuplicate migration versions:');
  for (const [version, files] of duplicates) {
    console.error(`- ${version}`);
    for (const fileName of files) console.error(`  - ${fileName}`);
  }
}

if (invalidNames.length > 0) {
  console.error('\nMigration files without a numeric version prefix:');
  for (const fileName of invalidNames) console.error(`- ${fileName}`);
}

if (bomFiles.length > 0) {
  console.error('\nMigration files containing a UTF-8 BOM:');
  for (const fileName of bomFiles) console.error(`- ${fileName}`);
}

if (duplicates.length > 0 || invalidNames.length > 0 || bomFiles.length > 0) {
  process.exitCode = 1;
} else {
  console.log('Supabase migration filename and encoding validation passed.');
}
