import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const apiRoot = path.join(root, 'app', 'api');

function routes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routes(full);
    return entry.isFile() && entry.name === 'route.ts' ? [full] : [];
  });
}

const routeFiles = routes(apiRoot);
const relative = (file: string) => path.relative(root, file).replaceAll('\\', '/');

const PUBLIC_ROUTE = [
  /^app\/api\/public\//,
  /^app\/api\/driver\/mobile\/config\/route\.ts$/,
  /^app\/api\/tracking\/share\//,
  /^app\/api\/onboarding\/submit\/route\.ts$/,
  /^app\/api\/location\/postcode-area\/route\.ts$/, // Public, bounded fixed-host postcode lookup.
];

const AUTH_MARKERS = [
  /getBearerToken/,
  /auth\.getUser/,
  /require[A-Z][A-Za-z]+/,
  /verifyPlatformOwner/,
  /buildSessionHandlers/,
  /buildSubmitHandler/,
  /Authorization/,
  /x-admin-key/i,
  /x-cron/i,
  /webhook/i,
  /signature/i,
  /secret/i,
];

const DELEGATE_MARKERS = [
  /buildSessionHandlers/,
  /buildSubmitHandler/,
  /readiness\/route/,
  /return submitInvoice\(request, context\)/, // Canonical helper enforces driver finance ownership.
];

describe('current API contract audit closure', () => {
  it('inventories the complete current App Router API surface', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(230);
  });

  it('has an explicit auth/delegation boundary for every non-public API route', () => {
    const missing = routeFiles.flatMap((file) => {
      const rel = relative(file);
      const source = fs.readFileSync(file, 'utf8');
      if (PUBLIC_ROUTE.some((pattern) => pattern.test(rel))) return [];
      const guarded = AUTH_MARKERS.some((pattern) => pattern.test(source));
      const delegated = DELEGATE_MARKERS.some((pattern) => pattern.test(source));
      return guarded || delegated ? [] : [rel];
    });
    expect(missing).toEqual([]);
  });

  it('does not expose service-role Supabase routes without an auth/delegation boundary unless intentionally public', () => {
    const unsafe = routeFiles.flatMap((file) => {
      const rel = relative(file);
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('supabaseAdmin')) return [];
      if (PUBLIC_ROUTE.some((pattern) => pattern.test(rel))) return [];
      const guarded = AUTH_MARKERS.some((pattern) => pattern.test(source));
      const delegated = DELEGATE_MARKERS.some((pattern) => pattern.test(source));
      return guarded || delegated ? [] : [rel];
    });
    expect(unsafe).toEqual([]);
  });

  it('audits delegated invoice submission auth and the bounded public postcode resolver', () => {
    const submit = fs.readFileSync(path.join(apiRoot, 'driver', 'finance', 'invoices', '[id]', 'submit', 'route.ts'), 'utf8');
    const helper = fs.readFileSync(path.join(root, 'lib', 'server', 'invoiceDelivery.ts'), 'utf8');
    const postcode = fs.readFileSync(path.join(apiRoot, 'location', 'postcode-area', 'route.ts'), 'utf8');
    expect(submit).toContain('return submitInvoice(request, context)');
    expect(helper).toContain('requireDriverFinanceAccess(request)');
    expect(helper).toContain('requirePod: Boolean(claimedInvoice.job_id)');
    expect(postcode).toContain('normaliseLocation(raw)');
    expect(postcode).toContain('https://api.postcodes.io/');
    expect(postcode).toContain('AbortSignal.timeout(5_000)');
    expect(postcode).not.toContain('supabaseAdmin');
  });

  it('keeps public intake fail-closed, validated and rate-limited', () => {
    const publicQuote = fs.readFileSync(path.join(apiRoot, 'public', 'quote-request', 'route.ts'), 'utf8');
    expect(publicQuote).toContain('payloadSchema.safeParse');
    expect(publicQuote).toContain('consume_public_quote_rate_limit');
    expect(publicQuote).toContain("status: 429");
    expect(publicQuote).toContain('XDRIVE_PUBLIC_INTAKE_COMPANY_ID');
  });

  it('keeps compatibility commercial readiness delegated to the canonical authenticated evaluator', () => {
    const compatibility = fs.readFileSync(path.join(apiRoot, 'workspace', 'commercial-readiness', 'route.ts'), 'utf8');
    const canonical = fs.readFileSync(path.join(apiRoot, 'workspace', 'readiness', 'route.ts'), 'utf8');
    expect(compatibility).toContain("from '../readiness/route'");
    expect(canonical).toContain('getBearerToken(request)');
    expect(canonical).toContain('supabaseValidator.auth.getUser(token)');
    expect(canonical).toContain('membership');
  });
});
