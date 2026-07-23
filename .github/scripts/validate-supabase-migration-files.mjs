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

const duplicates = Object.fromEntries(
  [...versions.entries()]
    .filter(([, files]) => files.length > 1)
    .sort(([left], [right]) => left.localeCompare(right, 'en')),
);

const report = {
  migrationFiles: entries.length,
  uniqueVersions: versions.size,
  duplicates,
  invalidNames,
  bomFiles,
};

console.log(`SUPABASE_MIGRATION_VALIDATION=${JSON.stringify(report)}`);

if (Object.keys(duplicates).length > 0 || invalidNames.length > 0 || bomFiles.length > 0) {
  process.exitCode = 1;
} else {
  console.log('Supabase migration filename and encoding validation passed.');
}
