import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Loads Quotes Diary share the approved CX visual identity across operational workspaces', () => {
  it.each([
    'app/components/workspace/CompanyMarketplaceExchange.tsx',
    'app/driver/loads/page.tsx',
    'app/broker/loads/page.tsx',
    'app/customer/CustomerOperationalPages.tsx',
  ])('%s uses the canonical Loads card anatomy', (file) => {
    const source = read(file);
    expect(source).toContain('xdrive-cx-load-card');
    expect(source).toContain('xdrive-cx-load-card__main');
    expect(source).toContain('xdrive-cx-load-card__route');
    expect(source).toContain('xdrive-cx-load-card__times');
    expect(source).toContain('xdrive-cx-load-card__status');
  });

  it.each([
    'app/components/workspace/CompanyMarketplaceExchange.tsx',
    'app/driver/quotes/page.tsx',
    'app/broker/bids/page.tsx',
    'app/customer/quotes/CustomerQuotesCxPage.tsx',
  ])('%s uses the canonical Quotes card anatomy', (file) => {
    const source = read(file);
    expect(source).toContain('xdrive-cx-quote-card');
    expect(source).toContain('xdrive-cx-quote-card__main');
    expect(source).toContain('xdrive-cx-quote-card__route');
    expect(source).toContain('xdrive-cx-quote-card__times');
    expect(source).toContain('xdrive-cx-quote-card__status');
    expect(source).toContain('xdrive-cx-quote-card__footer');
  });

  it.each([
    'app/components/workspace/OperationsDiaryPage.tsx',
    'app/driver/history/page.tsx',
    'app/broker/diary/page.tsx',
    'app/customer/diary/page.tsx',
  ])('%s uses the canonical Diary card anatomy', (file) => {
    const source = read(file);
    expect(source).toContain('xdrive-cx-diary-card');
    expect(source).toContain('xdrive-cx-diary-card__main');
    expect(source).toContain('xdrive-cx-diary-card__route');
    expect(source).toContain('xdrive-cx-diary-card__times');
    expect(source).toContain('xdrive-cx-diary-card__status');
    expect(source).toContain('xdrive-cx-diary-card__footer');
  });

  it('keeps Super Admin outside this visual convergence contract', () => {
    const source = read('app/super-admin/layout.tsx');
    expect(source).not.toContain('xdrive-workspace-measured');
  });
});
