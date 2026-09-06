import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(repo, rel), content, 'utf8');
}

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source block was not found.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) throw new Error(`${label}: source block is ambiguous.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

// ---------------------------------------------------------------------------
// 1. DriverContext: retain the richer commercial eligibility context that the
// shared quote contract expects, while preserving the recovery branch's public
// JWT validator and loopback-only Preview device bypass.
// ---------------------------------------------------------------------------
const mobileLibPath = 'app/api/driver/mobile/_lib.ts';
let mobileLib = read(mobileLibPath).replace(/\r\n/g, '\n');

mobileLib = replaceOnce(
  mobileLib,
  'driver context fields',
  `export type DriverContext = {\n  userId: string;\n  driverId: string;\n  companyId: string;\n  driverType: string | null;\n  canCommercialBid: boolean;\n};`,
  `export type DriverContext = {\n  userId: string;\n  driverId: string;\n  companyId: string;\n  driverStatus: string;\n  appAccess: boolean;\n  driverType: string | null;\n  canCommercialBid: boolean;\n  companyStatus: string | null;\n};`,
);

mobileLib = replaceOnce(
  mobileLib,
  'driver status normalization',
  `  if (String(profileRow.status ?? '').trim().toLowerCase() !== 'active') return respond(403, { error: 'Driver profile is not active.' });\n  if (String(driverRow.status ?? '').trim().toLowerCase() !== 'active') return respond(403, { error: 'Driver account is not active.' });`,
  `  const profileStatus = String(profileRow.status ?? '').trim().toLowerCase();\n  const driverStatus = String(driverRow.status ?? '').trim().toLowerCase();\n  if (profileStatus !== 'active') return respond(403, { error: 'Driver profile is not active.' });\n  if (driverStatus !== 'active') return respond(403, { error: 'Driver account is not active.' });`,
);

mobileLib = replaceOnce(
  mobileLib,
  'company commercial context',
  `  const companyId = String(driverRow.company_id ?? '').trim();\n  if (!companyId) return respond(403, { error: 'Driver company membership is required.' });\n\n  return {\n    userId: authData.user.id,\n    driverId,\n    companyId,\n    driverType: typeof driverRow.driver_type === 'string' ? driverRow.driver_type : null,\n    canCommercialBid: driverRow.can_commercial_bid === true,\n  };`,
  `  const companyId = String(driverRow.company_id ?? '').trim();\n  if (!companyId) return respond(403, { error: 'Driver company membership is required.' });\n\n  const { data: companyRow, error: companyError } = await supabaseAdmin\n    .from('companies')\n    .select('status')\n    .eq('id', companyId)\n    .maybeSingle();\n  if (companyError) return respond(500, { error: companyError.message });\n  const companyStatus = String(companyRow?.status ?? '').trim().toLowerCase() || null;\n\n  return {\n    userId: authData.user.id,\n    driverId,\n    companyId,\n    driverStatus,\n    appAccess: driverRow.app_access === true,\n    driverType: typeof driverRow.driver_type === 'string' ? driverRow.driver_type : null,\n    canCommercialBid: driverRow.can_commercial_bid === true,\n    companyStatus,\n  };`,
);

write(mobileLibPath, mobileLib);

// ---------------------------------------------------------------------------
// 2. Root TypeScript owns the Next/web project. The recovered native mobile
// project has its own tsconfig/typecheck and must not merge React Native global
// DOM declarations into Next's FormData/File types.
// ---------------------------------------------------------------------------
const tsconfigPath = 'tsconfig.json';
const tsconfig = JSON.parse(read(tsconfigPath));
tsconfig.compilerOptions = tsconfig.compilerOptions ?? {};
const types = new Set(Array.isArray(tsconfig.compilerOptions.types) ? tsconfig.compilerOptions.types : []);
types.add('node');
types.add('vitest/globals');
tsconfig.compilerOptions.types = [...types];
const excludes = new Set(Array.isArray(tsconfig.exclude) ? tsconfig.exclude : []);
excludes.add('apps/xdrive-driver-phone-golden/**');
tsconfig.exclude = [...excludes];
write(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

// ---------------------------------------------------------------------------
// 3. Restore the unit-test runner expected by the __tests__ contract files.
// Pin the version for reproducible local validation; npm updates the lockfile.
// ---------------------------------------------------------------------------
const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
pkg.scripts = pkg.scripts ?? {};
pkg.scripts['test:unit'] = 'vitest run';
pkg.devDependencies = pkg.devDependencies ?? {};
pkg.devDependencies.vitest = '4.1.10';
write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const vitestConfig = `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  esbuild: {\n    jsx: 'automatic',\n    jsxImportSource: 'react',\n  },\n  test: {\n    globals: true,\n    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],\n    exclude: ['e2e/**', 'node_modules/**'],\n  },\n});\n`;
write('vitest.config.ts', vitestConfig);

console.log('Driver runtime TypeScript/test closeout patch applied successfully.');
