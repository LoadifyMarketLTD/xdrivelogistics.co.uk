import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const preAwardClientSurfaces = [
  'app/driver/page.tsx',
  'app/driver/loads/page.tsx',
  'app/driver/loads/[id]/page.tsx',
  'app/driver/loads/search/page.tsx',
  'app/components/workspace/CompanyMarketplaceExchange.tsx',
];

describe('Marketplace consumer boundary', () => {
  it.each(preAwardClientSurfaces)('%s does not SELECT jobs directly from the browser', (relative) => {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    expect(source).not.toMatch(/\.from\(['"]jobs['"]\)/);
  });

  it('keeps pre-award Marketplace reads behind sanitising server routes', () => {
    const driverApi = fs.readFileSync(path.join(root, 'app/api/driver/marketplace/loads/route.ts'), 'utf8');
    const companyApi = fs.readFileSync(path.join(root, 'app/api/marketplace/company/route.ts'), 'utf8');
    const searchApi = fs.readFileSync(path.join(root, 'app/api/driver/search-loads/route.ts'), 'utf8');

    for (const source of [driverApi, companyApi, searchApi]) {
      expect(source).toContain('publicOutcode');
      expect(source).toContain('publicQuoteNotes');
    }
    expect(driverApi).toContain('pickup_area');
    expect(companyApi).toContain('publicSearchProjection');
    expect(searchApi).toContain('publicAreaLabel');
  });

  it('does not introduce a restrictive jobs SELECT migration before all native/direct consumers are migrated', () => {
    const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'));
    expect(migrations.filter((name) => name.includes('marketplace_preaward_privacy_guard'))).toEqual([]);
  });
});
