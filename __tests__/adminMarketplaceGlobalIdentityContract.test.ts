import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Admin Marketplace global visual identity contract', () => {
  it('loads the Admin Marketplace identity layer last in every white operational layout', () => {
    for (const file of [
      'app/admin/layout.tsx',
      'app/customer/layout.tsx',
      'app/broker/layout.tsx',
      'app/driver/layout.tsx',
    ]) {
      const source = read(file);
      expect(source).toContain("admin-marketplace-identity.css");
      const identityIndex = source.indexOf("admin-marketplace-identity.css");
      expect(identityIndex).toBeGreaterThan(source.indexOf("dashboard-compact-global.css"));
    }
  });

  it('marks every allowed Loads Quotes Diary implementation with the common identity', () => {
    const sources = [
      'app/components/workspace/CompanyMarketplaceExchange.tsx',
      'app/components/workspace/OperationsDiaryPage.tsx',
      'app/customer/CustomerOperationalPages.tsx',
      'app/customer/quotes/CustomerQuotesCxPage.tsx',
      'app/customer/diary/page.tsx',
      'app/broker/loads/page.tsx',
      'app/broker/bids/page.tsx',
      'app/broker/diary/page.tsx',
      'app/driver/loads/page.tsx',
      'app/driver/quotes/page.tsx',
      'app/driver/history/page.tsx',
    ];
    for (const file of sources) {
      expect(read(file), file).toContain('xdrive-admin-marketplace-identity');
    }
  });

  it('pins the measured Admin Marketplace geometry as the shared page contract', () => {
    const css = read('app/components/workspace/admin-marketplace-identity.css');
    expect(css).toContain('gap: 10px !important');
    expect(css).toContain('var(--ws-filter-rail-w, 165px)');
    expect(css).toContain('min-height: 27px !important');
    expect(css).toContain('height: 27px !important');
    expect(css).toContain('min-height: 32px !important');
    expect(css).toContain('min-height: 29px !important');
    expect(css).toContain('gap: 8px !important');
  });

  it('keeps Admin Marketplace Loads and Quotes on the same 10px rail-to-main gap', () => {
    const exchange = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
    expect(exchange).toContain("xdrive-loads-workspace-layout xdrive-admin-marketplace-identity");
    expect(exchange).toContain("tab === 'bids' && <div className=\"xdrive-exchange-workspace-layout xdrive-admin-marketplace-identity\" style={{ display: 'flex', alignItems: 'flex-start', gap: 10");
  });
});
