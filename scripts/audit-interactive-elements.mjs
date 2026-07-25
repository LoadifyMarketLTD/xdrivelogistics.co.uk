import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');
const MOBILE_DIR = path.join(ROOT, 'apps', 'driver-mobile', 'src');
const E2E_DIR = path.join(ROOT, 'e2e');
const OUT_DIR = path.join(ROOT, 'docs', 'audit');
const OUT_MATRIX = path.join(OUT_DIR, 'platform-interactive-matrix.json');
const OUT_SUMMARY = path.join(OUT_DIR, 'platform-interactive-summary.json');

const SOURCE_FILE_EXT = /\.(tsx|ts|jsx|js)$/;

const toPosix = (value) => value.split(path.sep).join('/');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(next)));
      continue;
    }
    out.push(next);
  }
  return out;
}

function routeFromPageFile(filePath) {
  const rel = toPosix(path.relative(APP_DIR, filePath));
  if (!rel.endsWith('/page.tsx')) return null;
  const route = `/${rel.replace(/\/page\.tsx$/, '')}`.replace(/\/index$/, '').replace(/\/+/g, '/');
  return route === '/page.tsx' || route === '/' ? '/' : route;
}

function roleForSource(sourceFile, targetRoute = '') {
  const source = toPosix(sourceFile);
  if (source.includes('/apps/driver-mobile/')) return 'Driver Android';
  if (targetRoute.startsWith('/super-admin') || source.includes('/app/super-admin/')) return 'Super Admin / Platform Owner';
  if (targetRoute.startsWith('/admin') || source.includes('/app/admin/')) return 'Admin / Operations';
  if (targetRoute.startsWith('/broker') || source.includes('/app/broker/')) return 'Broker';
  if (targetRoute.startsWith('/customer') || source.includes('/app/customer/')) return 'Customer';
  if (targetRoute.startsWith('/driver') || source.includes('/app/driver/')) return 'Driver Web';
  if (targetRoute.startsWith('/m/driver') || source.includes('/app/m/driver/')) return 'Driver Android';
  if (targetRoute.startsWith('/support') || source.includes('/app/support/')) return 'Support';
  if (targetRoute.startsWith('/compliance') || source.includes('/app/compliance/')) return 'Compliance';
  return 'Public / unauthenticated';
}

function sectionForRoute(route) {
  const bits = route.split('/').filter(Boolean);
  if (bits.length === 0) return 'Public';
  if (bits[0] === 'super-admin' && bits[1]) return bits[1];
  if (bits[0] === 'admin' && bits[1]) return bits[1];
  if (bits[0] === 'broker' && bits[1]) return bits[1];
  if (bits[0] === 'customer' && bits[1]) return bits[1];
  if (bits[0] === 'driver' && bits[1]) return bits[1];
  return bits[0];
}

function extractEntries(filePath, content) {
  const lines = content.split('\n');
  const entries = [];
  const push = (label, target, line, type) => {
    if (!target?.startsWith('/')) return;
    entries.push({
      label: label?.trim() || `${type} ${target}`,
      currentTarget: target.trim(),
      sourceFile: filePath,
      line,
      sourceType: type,
    });
  };

  const tupleRegex = /\[\s*['"`]([^'"`]+)['"`]\s*,\s*['"`](\/[^'"`]+)['"`]\s*\]/g;
  const objectLabelHrefRegex = /label:\s*['"`]([^'"`]+)['"`][^}\n]{0,220}?href:\s*['"`](\/[^'"`]+)['"`]/g;
  const objectHrefLabelRegex = /href:\s*['"`](\/[^'"`]+)['"`][^}\n]{0,220}?label:\s*['"`]([^'"`]+)['"`]/g;
  const routerPushRegex = /router\.push\(\s*['"`](\/[^'"`]+)['"`]\s*\)/g;
  const hrefRegex = /href=\s*['"`](\/[^'"`]+)['"`]/g;

  for (const [index, lineText] of lines.entries()) {
    let match;
    while ((match = tupleRegex.exec(lineText)) !== null) push(match[1], match[2], index + 1, 'tuple');
    while ((match = objectLabelHrefRegex.exec(lineText)) !== null) push(match[1], match[2], index + 1, 'object');
    while ((match = objectHrefLabelRegex.exec(lineText)) !== null) push(match[2], match[1], index + 1, 'object');
    while ((match = routerPushRegex.exec(lineText)) !== null) push('', match[1], index + 1, 'router.push');
    while ((match = hrefRegex.exec(lineText)) !== null) push('', match[1], index + 1, 'href');
  }

  const dedup = new Map();
  for (const entry of entries) {
    dedup.set(`${entry.sourceFile}:${entry.line}:${entry.label}:${entry.currentTarget}`, entry);
  }
  return [...dedup.values()];
}

function isPlaceholderPage(content) {
  const normalized = content.toLowerCase();
  return normalized.includes('superadminmodulepage')
    || normalized.includes('coming soon')
    || normalized.includes('placeholder')
    || normalized.includes('mock data');
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const appFiles = (await walk(APP_DIR)).filter((file) => SOURCE_FILE_EXT.test(file) && !toPosix(file).includes('/app/api/'));
  const mobileFiles = (await walk(MOBILE_DIR)).filter((file) => SOURCE_FILE_EXT.test(file));
  const e2eFiles = (await walk(E2E_DIR)).filter((file) => SOURCE_FILE_EXT.test(file));

  const pageFiles = appFiles.filter((file) => file.endsWith('/page.tsx'));
  const routeToFile = new Map();
  const dynamicRoutes = [];
  for (const pageFile of pageFiles) {
    const route = routeFromPageFile(pageFile);
    if (!route) continue;
    routeToFile.set(route, pageFile);
    if (route.includes('[')) {
      const regex = new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`);
      dynamicRoutes.push({ route, regex, file: pageFile });
    }
  }

  const placeholderRoutes = new Set();
  for (const [route, filePath] of routeToFile.entries()) {
    const content = await fs.readFile(filePath, 'utf8');
    if (isPlaceholderPage(content)) placeholderRoutes.add(route);
  }

  const e2eCorpus = (await Promise.all(e2eFiles.map((filePath) => fs.readFile(filePath, 'utf8')))).join('\n');

  const allSourceFiles = [...appFiles, ...mobileFiles];
  const extracted = [];
  let buttonWithoutHandlerCount = 0;
  for (const filePath of allSourceFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    extracted.push(...extractEntries(filePath, content));
    if (toPosix(filePath).includes('/app/') && !toPosix(filePath).includes('/app/api/')) {
      const buttonMatches = content.match(/<button\b[^>]*>/g) ?? [];
      for (const markup of buttonMatches) {
        if (/onClick=/.test(markup) || /type=['"]submit['"]/.test(markup) || /disabled/.test(markup)) continue;
        buttonWithoutHandlerCount += 1;
      }
    }
  }

  const targetUsageCount = new Map();
  for (const item of extracted) {
    const key = `${roleForSource(item.sourceFile, item.currentTarget)}|${item.currentTarget}`;
    targetUsageCount.set(key, (targetUsageCount.get(key) ?? 0) + 1);
  }

  const matrix = [];
  for (const item of extracted) {
    let targetFile = routeToFile.get(item.currentTarget) ?? null;
    let routeExists = Boolean(targetFile);
    if (!routeExists) {
      for (const dynamicRoute of dynamicRoutes) {
        if (dynamicRoute.regex.test(item.currentTarget)) {
          routeExists = true;
          targetFile = dynamicRoute.file;
          break;
        }
      }
    }
    const targetContent = targetFile ? await fs.readFile(targetFile, 'utf8') : '';
    const pageReal = routeExists && !placeholderRoutes.has(routeFromPageFile(targetFile ?? '') ?? '');
    const apiRpc = routeExists && (targetContent.includes('/api/') || targetContent.includes('supabase.') || targetContent.includes('.rpc('));
    const db = routeExists && (targetContent.includes(".from('") || targetContent.includes('.from("') || targetContent.includes('.rpc('));
    const e2e = e2eCorpus.includes(item.currentTarget);
    const duplicate = (targetUsageCount.get(`${roleForSource(item.sourceFile, item.currentTarget)}|${item.currentTarget}`) ?? 0) > 1;

    let status = 'PARTIAL';
    if (!routeExists) status = 'BROKEN';
    else if (!pageReal) status = 'PLACEHOLDER';
    else if (duplicate) status = 'DUPLICATE';
    else if (apiRpc && db && e2e) status = 'CLOSED';

    const fix =
      status === 'BROKEN' ? 'Correct target route or create missing page.' :
      status === 'PLACEHOLDER' ? 'Replace placeholder/mock view with role workflow page.' :
      status === 'DUPLICATE' ? 'Consolidate duplicate entry points to canonical workflow.' :
      status === 'PARTIAL' ? 'Complete API/DB/RLS/audit/E2E workflow chain.' :
      'No fix required.';

    matrix.push({
      role: roleForSource(item.sourceFile, item.currentTarget),
      section: sectionForRoute(item.currentTarget),
      element: item.label,
      sourceFile: toPosix(path.relative(ROOT, item.sourceFile)),
      currentTarget: item.currentTarget,
      routeExists,
      pageReal,
      apiRpc,
      db,
      rls: false,
      audit: false,
      e2e,
      status,
      fix,
    });
  }

  const summary = matrix.reduce((acc, row) => {
    acc.total += 1;
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, { total: 0, CLOSED: 0, PARTIAL: 0, BROKEN: 0, PLACEHOLDER: 0, DUPLICATE: 0, OBSOLETE: 0 });

  const linkedTargets = new Set(matrix.map((row) => row.currentTarget));
  const inaccessiblePages = [...routeToFile.keys()]
    .filter((route) => !linkedTargets.has(route))
    .map((route) => ({ route, sourceFile: toPosix(path.relative(ROOT, routeToFile.get(route) ?? '')) }));
  const brokenTargets = matrix.filter((row) => row.status === 'BROKEN').map((row) => row.currentTarget);
  const duplicateTargets = matrix.filter((row) => row.status === 'DUPLICATE').map((row) => row.currentTarget);
  const placeholderTargets = matrix.filter((row) => row.status === 'PLACEHOLDER').map((row) => row.currentTarget);
  const diagnostic = {
    buttonWithoutHandlerCount,
    linksWithoutPageCount: brokenTargets.length,
    duplicateRouteTargetsCount: duplicateTargets.length,
    placeholderTargetsCount: placeholderTargets.length,
    inaccessiblePagesCount: inaccessiblePages.length,
    inaccessiblePages,
    brokenTargets,
    duplicateTargets,
    placeholderTargets,
  };

  await fs.writeFile(OUT_MATRIX, JSON.stringify(matrix, null, 2));
  await fs.writeFile(OUT_SUMMARY, JSON.stringify({ ...summary, diagnostic }, null, 2));

  console.log(JSON.stringify({ matrixFile: OUT_MATRIX, summaryFile: OUT_SUMMARY, ...summary, diagnostic }, null, 2));
}

void run();
