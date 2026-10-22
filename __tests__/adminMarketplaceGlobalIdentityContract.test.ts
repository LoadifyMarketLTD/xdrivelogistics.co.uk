import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Admin Marketplace global visual identity contract', () => {
  it('loads the shared identity and readable baseline after role-specific workspace CSS', () => {
    for (const file of [
      'app/admin/layout.tsx',
      'app/customer/layout.tsx',
      'app/broker/layout.tsx',
      'app/driver/layout.tsx',
    ]) {
      const source = read(file);
      expect(source).toContain('admin-marketplace-identity.css');
      expect(source).toContain('workspace-readable-typography.css');
      const identityIndex = source.indexOf('admin-marketplace-identity.css');
      const readableIndex = source.indexOf('workspace-readable-typography.css');
      expect(identityIndex).toBeGreaterThan(source.indexOf('dashboard-compact-global.css'));
      expect(readableIndex).toBeGreaterThan(identityIndex);
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

  it('uses the approved global readable geometry as the shared page contract', () => {
    const css = read('app/components/workspace/admin-marketplace-identity.css');
    expect(css).toContain('gap: var(--ws-gap-grid, 14px) !important');
    expect(css).toContain('var(--ws-filter-rail-w, 196px)');
    expect(css).toContain('min-height: var(--ws-control-h, 32px) !important');
    expect(css).toContain('height: var(--ws-control-h, 32px) !important');
    expect(css).toContain('min-height: var(--ws-panel-head-h, 40px) !important');
    expect(css).toContain('min-height: var(--ws-tab-h, 32px) !important');
    expect(css).toContain('gap: 8px !important');
    expect(css).not.toContain('min-height: 27px !important');
    expect(css).not.toContain('height: 27px !important');
  });

  it('keeps Loads and Quotes on the same global rail-to-main geometry', () => {
    const exchange = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
    expect(exchange).toContain('xdrive-loads-workspace-layout xdrive-admin-marketplace-identity');
    expect(exchange).toContain('xdrive-exchange-workspace-layout xdrive-admin-marketplace-identity');
    expect(exchange).toContain('var(--ws-filter-rail-w, 196px)');
    expect(exchange).not.toContain("alignItems: 'flex-start', gap: 10");
  });
});
