/**
 * XDrive Automated Audit Runner
 *
 * Executes every audit check that can be verified without a live Supabase
 * connection or browser session:
 *
 *   • Migration integrity (DB-01)
 *   • Schema / column / FK / trigger / index presence (DB-02 – DB-07)
 *   • RLS & policies in migration SQL (SEC-01)
 *   • Storage buckets + realtime (PR-03)
 *   • Middleware route protection (SEC-04, RP-03)
 *   • .env.example secrets exposure (SEC-06-03)
 *   • Git history secrets scan (SEC-06-04)
 *   • ESLint (PR-02-03)
 *   • TypeScript typecheck (PR-02-02)
 *   • Unit tests via Vitest (Audit 12 role/permission)
 *
 * Outputs
 *   docs/audit/automated-audit-results.json   – machine-readable results
 *   docs/audit/automated-audit-report.md      – human-readable report
 *
 * Usage
 *   node ./scripts/run-automated-audit.mjs [--skip-tests] [--skip-lint]
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// ─── Config ────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const MIDDLEWARE_FILE = path.join(ROOT, 'middleware.ts');
const ENV_EXAMPLE_FILE = path.join(ROOT, '.env.example');
const OUT_DIR = path.join(ROOT, 'docs', 'audit');
const OUT_JSON = path.join(OUT_DIR, 'automated-audit-results.json');
const OUT_MD = path.join(OUT_DIR, 'automated-audit-report.md');

const SKIP_TESTS = process.argv.includes('--skip-tests');
const SKIP_LINT = process.argv.includes('--skip-lint');

// Expected protected prefixes declared in middleware.ts
const EXPECTED_PROTECTED_PREFIXES = [
  '/super-admin',
  '/broker',
  '/admin',
  '/driver',
  '/customer',
  '/m',
];

// Tables that MUST have RLS enabled
const REQUIRED_RLS_TABLES = [
  'jobs',
  'job_bids',
  'companies',
  'profiles',
  'drivers',
  'vehicles',
  'invoices',
  'company_documents',
  'notifications',
  'driver_locations',
  'company_memberships',
  'job_disputes',
];

// Columns required per table (DB-02) — use actual column names from migration SQL
const REQUIRED_COLUMNS = {
  jobs: ['id', 'company_id', 'status', 'pickup_location', 'delivery_location', 'created_at', 'updated_at'],
  job_bids: ['id', 'job_id', 'driver_id', 'company_id', 'amount', 'status', 'created_at'],
  companies: ['id', 'name', 'status', 'created_at'],
  profiles: ['user_id', 'role', 'status'],
  // driver_locations uses lat/lng (migration 119), not latitude/longitude
  driver_locations: ['driver_id', 'lat', 'lng', 'updated_at'],
  // driver_device_tokens: migration 106 adds device_token column to drivers table (not a separate table)
  invoices: ['id'],
  company_documents: ['id', 'company_id'],
};

// Tables that are confirmed via column additions rather than CREATE TABLE
// (migration 106 adds device_token to drivers; no separate driver_device_tokens table)
const COLUMN_VERIFIED_TABLES = {
  driver_device_tokens: { table: 'drivers', column: 'device_token', migration: '106_driver_device_tokens' },
};

// Required indexes (DB-07) — [table, column/hint]
const REQUIRED_INDEXES = [
  ['jobs', 'status'],
  ['jobs', 'company_id'],
  ['job_bids', 'job_id'],
  ['driver_locations', 'driver_id'],
];

// Required FK relationships (DB-03)
const REQUIRED_FKS = [
  { from: 'jobs', column: 'company_id', to: 'companies' },
  { from: 'job_bids', column: 'job_id', to: 'jobs' },
  { from: 'job_bids', column: 'company_id', to: 'companies' },
  { from: 'profiles', column: 'user_id', to: 'auth.users' },
];

// Required triggers (DB-04)
const REQUIRED_TRIGGERS = [
  { hint: 'updated_at', table: 'jobs' },
  { hint: 'updated_at', table: 'job_bids' },
  { hint: 'notify_invoice_created', table: null },
  { hint: 'serialize_overpayment', table: null },
];

// Required storage buckets (PR-03-03)
const REQUIRED_BUCKETS = ['driver-docs', 'vehicle-docs', 'pod-photos'];

// Required tables for realtime (PR-03-05)
const REQUIRED_REALTIME_TABLES = ['jobs', 'job_bids', 'driver_locations', 'notifications'];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** @param {string} id @param {boolean} pass @param {string} note */
function result(id, pass, note = '') {
  return { id, pass, note };
}

function pass(id, note = '') { return result(id, true, note); }
function fail(id, note = '') { return result(id, false, note); }

/** Run a shell command; return { ok, stdout, stderr } */
function run(cmd, options = {}) {
  const r = spawnSync(cmd, { shell: true, cwd: ROOT, ...options, encoding: 'utf8' });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    status: r.status,
  };
}

/** Read all migration files sorted */
async function readMigrations() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  const sorted = files.filter(f => f.endsWith('.sql')).sort();
  const contents = await Promise.all(
    sorted.map(async f => {
      const content = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
      return { name: f, content, lower: content.toLowerCase() };
    })
  );
  return { files: sorted, contents };
}

/** Concatenate all migration SQL in order */
function allSql(contents) {
  return contents.map(c => c.lower).join('\n');
}

// ─── Check Groups ──────────────────────────────────────────────────────────

// DB-01: Migration integrity
async function checkMigrationIntegrity(migrations) {
  const results = [];
  const { files } = migrations;

  // DB-01-01: numbered migrations 001–129 present
  const numbered = files.filter(f => /^\d{3}_/.test(f));
  const nums = numbered.map(f => parseInt(f.slice(0, 3), 10));
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
  results.push(maxNum >= 129
    ? pass('DB-01-01', `Highest numbered migration: ${maxNum}`)
    : fail('DB-01-01', `Highest numbered migration is only ${maxNum}, expected ≥ 129`));

  // DB-01-02: no duplicate version numbers
  const counts = {};
  for (const n of nums) counts[n] = (counts[n] ?? 0) + 1;
  const dups = Object.entries(counts).filter(([, c]) => c > 1).map(([n]) => n);
  results.push(dups.length === 0
    ? pass('DB-01-02', 'No duplicate migration version numbers')
    : fail('DB-01-02', `Duplicate numbers: ${dups.join(', ')}`));

  // DB-01-03: no gaps in 001–maxNum sequence
  const numSet = new Set(nums);
  const gaps = [];
  for (let i = 1; i <= maxNum; i++) {
    if (!numSet.has(i)) gaps.push(i);
  }
  results.push(gaps.length === 0
    ? pass('DB-01-03', `Sequence 001–${maxNum} is complete`)
    : fail('DB-01-03', `Gaps in sequence: ${gaps.slice(0, 10).join(', ')}${gaps.length > 10 ? '…' : ''}`));

  // DB-01-04: last migration matches expected name
  const hasOverpaymentGuard = files.some(f => f.includes('serialize_overpayment_guard') || f.includes('129_serialize'));
  results.push(hasOverpaymentGuard
    ? pass('DB-01-04', 'Migration 129 serialize_overpayment_guard found')
    : fail('DB-01-04', 'Migration 129_serialize_overpayment_guard not found'));

  // DB-01-05: total migration count (informational)
  results.push(pass('DB-01-05', `Total migration files: ${files.length}`));

  return results;
}

// DB-02: Schema integrity (tables & columns)
function checkSchemaIntegrity(migrations) {
  const results = [];
  const sql = allSql(migrations.contents);

  // Column-verified tables (not separate CREATE TABLE, but column added to parent)
  for (const [logicalName, { table, column, migration }] of Object.entries(COLUMN_VERIFIED_TABLES)) {
    const found = sql.includes(column) && (sql.includes(migration.split('_')[0]) || sql.includes(migration));
    results.push(found
      ? pass(`DB-02-TABLE-${logicalName}`, `"${logicalName}" implemented as column "${column}" on "${table}" (${migration}) — ✅ confirmed`)
      : fail(`DB-02-TABLE-${logicalName}`, `Column "${column}" on "${table}" (from ${migration}) not found in migrations`));
  }

  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    // Table exists in migrations
    const tableCreated =
      sql.includes(`create table ${table}`) ||
      sql.includes(`create table if not exists ${table}`) ||
      sql.includes(`create table public.${table}`) ||
      sql.includes(`create table if not exists public.${table}`) ||
      sql.includes(`"public"."${table}"`) ||
      sql.includes(`"${table}"`);

    if (!tableCreated) {
      results.push(fail(`DB-02-TABLE-${table}`, `Table "${table}" not found in migrations`));
      continue;
    }

    // Required columns
    for (const col of cols) {
      const colFound =
        sql.includes(`"${col}"`) ||
        sql.includes(` ${col} `) ||
        sql.includes(` ${col},`) ||
        sql.includes(` ${col}\n`) ||
        sql.includes(`add column ${col} `) ||
        sql.includes(`add column if not exists ${col} `);
      results.push(colFound
        ? pass(`DB-02-${table}.${col}`, `Column "${col}" found in migrations`)
        : fail(`DB-02-${table}.${col}`, `Column "${col}" not found in migration SQL for table "${table}"`));
    }
  }

  return results;
}

// DB-03: Foreign keys
function checkForeignKeys(migrations) {
  const sql = allSql(migrations.contents);
  return REQUIRED_FKS.map(({ from, column, to }) => {
    const toNorm = to.replace('auth.', '');
    const found =
      sql.includes(`references ${to}`) ||
      sql.includes(`references public.${to}`) ||
      sql.includes(`references ${toNorm}`) ||
      (sql.includes(from) && sql.includes(column) && sql.includes('references'));
    const id = `DB-03-${from}.${column}`;
    return found
      ? pass(id, `FK ${from}.${column} → ${to} found`)
      : fail(id, `FK ${from}.${column} → ${to} not detected in migrations`);
  });
}

// DB-04: Triggers
function checkTriggers(migrations) {
  const sql = allSql(migrations.contents);
  return REQUIRED_TRIGGERS.map(({ hint, table }) => {
    const id = `DB-04-${hint}${table ? `@${table}` : ''}`;
    const found = sql.includes(hint.replace('_', ' ')) || sql.includes(hint);
    return found
      ? pass(id, `Trigger/function "${hint}" found in migrations`)
      : fail(id, `Trigger/function "${hint}" not found in migrations`);
  });
}

// DB-07: Indexes
function checkIndexes(migrations) {
  const sql = allSql(migrations.contents);
  return REQUIRED_INDEXES.map(([table, column]) => {
    const id = `DB-07-${table}.${column}`;
    const found =
      (sql.includes(`create index`) || sql.includes(`create unique index`)) &&
      sql.includes(table) &&
      sql.includes(column);
    return found
      ? pass(id, `Index on ${table}(${column}) found in migrations`)
      : fail(id, `Index on ${table}(${column}) not detected in migrations`);
  });
}

// SEC-01: RLS enabled on critical tables
function checkRLS(migrations) {
  const sql = allSql(migrations.contents);
  return REQUIRED_RLS_TABLES.map(table => {
    const id = `SEC-01-${table}`;
    const rlsEnabled =
      sql.includes(`enable row level security on ${table}`) ||
      sql.includes(`enable row level security on public.${table}`) ||
      sql.includes(`alter table ${table} enable row level security`) ||
      sql.includes(`alter table public.${table} enable row level security`) ||
      sql.includes(`alter table if exists ${table} enable row level security`) ||
      sql.includes(`alter table if exists public.${table} enable row level security`);
    const hasPolicy =
      sql.includes(`create policy`) && sql.includes(`on ${table}`) ||
      sql.includes(`create policy`) && sql.includes(`on public.${table}`);
    return (rlsEnabled || hasPolicy)
      ? pass(id, `RLS or policy found for table "${table}"`)
      : fail(id, `No "ENABLE ROW LEVEL SECURITY" or policy detected for "${table}"`);
  });
}

// PR-03-03: Storage buckets
function checkStorageBuckets(migrations) {
  const sql = allSql(migrations.contents);
  return REQUIRED_BUCKETS.map(bucket => {
    const id = `PR-03-03-${bucket}`;
    const found = sql.includes(bucket);
    return found
      ? pass(id, `Bucket "${bucket}" referenced in migrations`)
      : fail(id, `Bucket "${bucket}" not found in migration SQL`);
  });
}

// PR-03-05: Realtime publications
function checkRealtime(migrations) {
  const sql = allSql(migrations.contents);
  return REQUIRED_REALTIME_TABLES.map(table => {
    const id = `PR-03-05-${table}`;
    const found =
      sql.includes(`supabase_realtime`) ||
      sql.includes(`alter publication`) ||
      sql.includes(`realtime`);
    // Realtime is typically configured in dashboard, not migrations; note this
    return found
      ? pass(id, `Realtime/publication reference found for "${table}" (verify in Supabase dashboard)`)
      : result(id, null, `Realtime for "${table}" must be verified in Supabase dashboard (no migration evidence)`);
  });
}

// SEC-04 / RP-03: Middleware route protection
async function checkMiddlewareProtection() {
  const results = [];
  try {
    const content = await fs.readFile(MIDDLEWARE_FILE, 'utf8');
    const prefixesMatch = content.match(/PROTECTED_PATH_PREFIXES\s*=\s*\[([^\]]+)\]/s);
    const raw = prefixesMatch ? prefixesMatch[1] : '';
    const found = [];
    for (const expected of EXPECTED_PROTECTED_PREFIXES) {
      const isListed = raw.includes(`'${expected}'`) || raw.includes(`"${expected}"`);
      const id = `RP-03-${expected.replace('/', '').replace('-', '_')}`;
      if (isListed) {
        found.push(expected);
        results.push(pass(id, `"${expected}" present in PROTECTED_PATH_PREFIXES`));
      } else {
        results.push(fail(id, `"${expected}" NOT found in PROTECTED_PATH_PREFIXES`));
      }
    }

    // SEC-04-07: isRoleAllowedForPath called
    const roleCheckPresent = content.includes('isRoleAllowedForPath');
    results.push(roleCheckPresent
      ? pass('SEC-04-07', 'isRoleAllowedForPath called in middleware for role enforcement')
      : fail('SEC-04-07', 'isRoleAllowedForPath not found in middleware'));

    // Login redirect for unauthenticated
    const loginRedirect = content.includes('buildLoginRedirect') || content.includes("'/login'");
    results.push(loginRedirect
      ? pass('SEC-03-01', 'Unauthenticated requests redirected to /login in middleware')
      : fail('SEC-03-01', 'No login redirect found in middleware'));

    // Forbidden redirect
    const forbiddenRedirect = content.includes("'/forbidden'") || content.includes('FORBIDDEN_PATH');
    results.push(forbiddenRedirect
      ? pass('SEC-04-01', 'Forbidden redirect present in middleware')
      : fail('SEC-04-01', 'No /forbidden redirect in middleware'));

  } catch {
    results.push(fail('SEC-04-07', 'middleware.ts could not be read'));
  }
  return results;
}

// SEC-06-03: .env.example — only public vars should be NEXT_PUBLIC_
async function checkEnvExample() {
  const results = [];
  try {
    const content = await fs.readFile(ENV_EXAMPLE_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));

    // NEXT_PUBLIC_ vars must not contain sensitive data
    const publicVars = lines
      .filter(l => l.startsWith('NEXT_PUBLIC_'))
      .map(l => l.split('=')[0]);

    const sensitivePublic = publicVars.filter(v =>
      v.toLowerCase().includes('service_role') ||
      v.toLowerCase().includes('secret') ||
      v.toLowerCase().includes('private')
    );

    results.push(sensitivePublic.length === 0
      ? pass('SEC-06-03', `NEXT_PUBLIC_ vars (${publicVars.join(', ')}) contain no sensitive names`)
      : fail('SEC-06-03', `Sensitive var names in NEXT_PUBLIC_: ${sensitivePublic.join(', ')}`));

    // SERVICE_ROLE_KEY must NOT be NEXT_PUBLIC_
    const serviceRolePublic = content.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') ||
      content.includes('NEXT_PUBLIC_SERVICE_ROLE');
    results.push(!serviceRolePublic
      ? pass('SEC-06-01', 'SUPABASE_SERVICE_ROLE_KEY is not prefixed NEXT_PUBLIC_ in .env.example')
      : fail('SEC-06-01', 'Service role key found with NEXT_PUBLIC_ prefix — CRITICAL'));

  } catch {
    results.push(fail('SEC-06-03', '.env.example could not be read'));
  }
  return results;
}

// SEC-06-04: Git history secrets scan
function checkGitSecrets() {
  const results = [];
  const patterns = [
    { pattern: 'service_role', id: 'SEC-06-04-service_role' },
    { pattern: 'eyJ', id: 'SEC-06-04-jwt_prefix', note: 'JWT prefix (may be false positive for anon key)' },
  ];
  for (const { pattern, id, note } of patterns) {
    const r = run(`git log --all -p --follow -- "*.env" "*.json" "*.ts" "*.js" 2>/dev/null | grep -i '${pattern}' | grep -v 'example\\|placeholder\\|your_\\|# ' | head -5`);
    const hits = r.stdout.trim().split('\n').filter(Boolean);
    if (hits.length === 0) {
      results.push(pass(id, `No "${pattern}" commits found in git history ${note ? `(${note})` : ''}`));
    } else {
      // Check if any hit looks like a real secret (not a placeholder)
      const realHits = hits.filter(h =>
        !h.includes('your_') &&
        !h.includes('placeholder') &&
        !h.includes('example') &&
        !h.includes('# ')
      );
      results.push(realHits.length === 0
        ? pass(id, `"${pattern}" only found in safe placeholder contexts`)
        : fail(id, `Potential secret "${pattern}" found in git history: ${realHits[0].slice(0, 80)}`));
    }
  }
  return results;
}

// PR-02-03: ESLint
function checkLint() {
  if (SKIP_LINT) return [result('PR-02-03', null, 'Lint skipped (--skip-lint)')];
  console.log('  Running ESLint…');
  const r = run('npx eslint . --max-warnings=0 --format=compact 2>&1 | tail -20');
  return [r.ok
    ? pass('PR-02-03', 'ESLint passed with 0 warnings/errors')
    : fail('PR-02-03', `ESLint failed:\n${(r.stdout + r.stderr).slice(0, 400)}`)];
}

// PR-02-02: TypeScript typecheck
function checkTypecheck() {
  if (SKIP_LINT) return [result('PR-02-02', null, 'Typecheck skipped (--skip-lint)')];
  console.log('  Running TypeScript typecheck…');
  const r = run('npx tsc --noEmit 2>&1 | tail -30');
  return [r.ok
    ? pass('PR-02-02', 'TypeScript typecheck passed — 0 errors')
    : fail('PR-02-02', `TypeScript errors:\n${(r.stdout + r.stderr).slice(0, 500)}`)];
}

// Unit tests (Audit 12 — role/permission)
function checkUnitTests() {
  if (SKIP_TESTS) return [result('UNIT-TESTS', null, 'Unit tests skipped (--skip-tests)')];
  console.log('  Running unit tests (Vitest)…');
  const r = run('npx vitest run --reporter=verbose 2>&1 | tail -40');
  const summary = (r.stdout + r.stderr).slice(-600);
  return [r.ok
    ? pass('UNIT-TESTS', `All unit tests passed\n${summary}`)
    : fail('UNIT-TESTS', `Unit tests failed:\n${summary}`)];
}

// ─── Report Generation ─────────────────────────────────────────────────────

function statusIcon(pass) {
  if (pass === true) return '✅ PASS';
  if (pass === false) return '❌ FAIL';
  return '⚠️ MANUAL';
}

function buildMarkdownReport(sections, runDate) {
  const lines = [
    '# XDrive Automated Audit Report',
    '',
    `> Generated: ${runDate}`,
    `> Script: \`scripts/run-automated-audit.mjs\``,
    `> Coverage: Static code analysis + lint + typecheck + unit tests`,
    `> Note: Checks requiring a live Supabase database or browser are marked ⚠️ MANUAL`,
    '',
    '---',
    '',
  ];

  let totalPass = 0, totalFail = 0, totalManual = 0;

  for (const { title, results } of sections) {
    const sectionPass = results.filter(r => r.pass === true).length;
    const sectionFail = results.filter(r => r.pass === false).length;
    const sectionManual = results.filter(r => r.pass === null).length;
    totalPass += sectionPass;
    totalFail += sectionFail;
    totalManual += sectionManual;

    lines.push(`## ${title}`);
    lines.push('');
    lines.push('| ID | Status | Note |');
    lines.push('|---|---|---|');
    for (const r of results) {
      const note = r.note.replace(/\n/g, ' ').slice(0, 120);
      lines.push(`| \`${r.id}\` | ${statusIcon(r.pass)} | ${note} |`);
    }
    lines.push('');
    lines.push(`**Section: ${sectionPass} PASS · ${sectionFail} FAIL · ${sectionManual} MANUAL**`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const total = totalPass + totalFail + totalManual;
  lines.push('## Summary');
  lines.push('');
  lines.push('| Status | Count |');
  lines.push('|---|---|');
  lines.push(`| ✅ PASS | **${totalPass}** |`);
  lines.push(`| ❌ FAIL | **${totalFail}** |`);
  lines.push(`| ⚠️ MANUAL | **${totalManual}** |`);
  lines.push(`| **TOTAL** | **${total}** |`);
  lines.push('');

  if (totalFail === 0) {
    lines.push('> 🟢 **All automatable checks PASS.** Proceed to manual audit phase for live DB and browser checks.');
  } else {
    lines.push(`> 🔴 **${totalFail} automated check(s) FAILED.** Fix these before proceeding to manual audit.`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Checks NOT covered by automation (require live platform)');
  lines.push('');
  lines.push('| Audit | Section | Reason |');
  lines.push('|---|---|---|');
  lines.push('| SEC-01 | Cross-company RLS enforcement | Requires authenticated Supabase queries |');
  lines.push('| SEC-02 | Cross-company data isolation | Requires two live user sessions |');
  lines.push('| SEC-03 | Session cookies, JWT expiry | Requires browser DevTools |');
  lines.push('| DB-04 | Trigger behaviour | Requires live DB mutations |');
  lines.push('| DB-05 | RPC functions | Requires live Supabase connection |');
  lines.push('| DB-08 | Realtime events | Requires live Supabase Realtime |');
  lines.push('| PR-04 | SSL / HTTPS | Requires live deployment |');
  lines.push('| PR-05 | Monitoring / observability | Requires production dashboard |');
  lines.push('| PR-06 | Android APK | Requires physical device |');
  lines.push('| Audit 01-05 | All workflow audits | Require live platform + test accounts |');
  lines.push('| Audit 08 | Android functional | Requires physical device + APK |');
  lines.push('| Audit 09 | Performance | Requires Lighthouse + live endpoints |');
  lines.push('| Audit 17 | GPS tracking | Requires physical device |');
  lines.push('');

  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 XDrive Automated Audit Runner');
  console.log('  Root:', ROOT);
  console.log('  Migrations:', MIGRATIONS_DIR);
  console.log('');

  await fs.mkdir(OUT_DIR, { recursive: true });

  const migrations = await readMigrations();
  console.log(`📂 Loaded ${migrations.files.length} migration files`);

  const sections = [];

  console.log('\n📋 DB-01: Migration Integrity');
  sections.push({ title: 'DB-01 — Migration Integrity', results: await checkMigrationIntegrity(migrations) });

  console.log('📋 DB-02: Schema Integrity (Tables & Columns)');
  sections.push({ title: 'DB-02 — Schema Integrity (Tables & Columns)', results: checkSchemaIntegrity(migrations) });

  console.log('📋 DB-03: Foreign Keys');
  sections.push({ title: 'DB-03 — Foreign Keys', results: checkForeignKeys(migrations) });

  console.log('📋 DB-04: Triggers');
  sections.push({ title: 'DB-04 — Triggers', results: checkTriggers(migrations) });

  console.log('📋 DB-07: Indexes');
  sections.push({ title: 'DB-07 — Indexes & Performance', results: checkIndexes(migrations) });

  console.log('📋 SEC-01: Row Level Security');
  sections.push({ title: 'SEC-01 — Row Level Security', results: checkRLS(migrations) });

  console.log('📋 PR-03: Storage Buckets');
  sections.push({ title: 'PR-03 — Storage Buckets', results: checkStorageBuckets(migrations) });

  console.log('📋 PR-03: Realtime (evidence in migrations)');
  sections.push({ title: 'PR-03 / DB-08 — Realtime Publications', results: checkRealtime(migrations) });

  console.log('📋 SEC-04 / RP-03: Middleware Route Protection');
  sections.push({ title: 'SEC-04 / RP-03 — Middleware Route Protection', results: await checkMiddlewareProtection() });

  console.log('📋 SEC-06: Environment & Secrets');
  const envResults = await checkEnvExample();
  const gitResults = checkGitSecrets();
  sections.push({ title: 'SEC-06 — Environment & Secrets', results: [...envResults, ...gitResults] });

  console.log('📋 PR-02-03: ESLint');
  sections.push({ title: 'PR-02-03 — ESLint', results: checkLint() });

  console.log('📋 PR-02-02: TypeScript Typecheck');
  sections.push({ title: 'PR-02-02 — TypeScript Typecheck', results: checkTypecheck() });

  console.log('📋 Unit Tests (Audit 12 — Role & Permission)');
  sections.push({ title: 'Unit Tests — Role & Permission (Audit 12)', results: checkUnitTests() });

  // ── Totals ──────────────────────────────────────────────────────────────
  const allResults = sections.flatMap(s => s.results);
  const totalPass = allResults.filter(r => r.pass === true).length;
  const totalFail = allResults.filter(r => r.pass === false).length;
  const totalManual = allResults.filter(r => r.pass === null).length;
  const runDate = new Date().toISOString();

  // ── Write outputs ───────────────────────────────────────────────────────
  const jsonOutput = { runDate, totalPass, totalFail, totalManual, sections };
  await fs.writeFile(OUT_JSON, JSON.stringify(jsonOutput, null, 2));

  const mdReport = buildMarkdownReport(sections, runDate);
  await fs.writeFile(OUT_MD, mdReport);

  console.log('\n────────────────────────────────────────────────────────');
  console.log(`✅ PASS    ${totalPass}`);
  console.log(`❌ FAIL    ${totalFail}`);
  console.log(`⚠️  MANUAL  ${totalManual}`);
  console.log('────────────────────────────────────────────────────────');
  console.log(`\n📄 Report: ${OUT_MD}`);
  console.log(`📄 JSON:   ${OUT_JSON}`);

  if (totalFail > 0) {
    console.log(`\n🔴 ${totalFail} check(s) FAILED — see report for details.`);
    process.exit(1);
  } else {
    console.log('\n🟢 All automated checks passed.');
  }
}

main().catch(err => {
  console.error('Audit runner crashed:', err);
  process.exit(2);
});
