import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const preAwardClientSurfaces = [
  'app/driver/DriverDashboardHome.tsx',
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

  it('keeps the database privacy guard in the forward migration set', () => {
    const sql = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260815003000_marketplace_preaward_privacy_guard.sql'),
      'utf8',
    );
    expect(sql).toContain('as restrictive');
    expect(sql).toContain("lower(coalesce(status::text, '')) in ('posted', 'quoted')");
    expect(sql).toContain('awarded_carrier_company_id is null');
    expect(sql).toContain('cm.user_id = auth.uid()');
    expect(sql).toContain('p.user_id = auth.uid()');
  });
});
