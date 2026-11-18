import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('operational workspaces render the approved shared CX card anatomy', () => {
  it.each([
    'app/components/workspace/CompanyMarketplaceExchange.tsx',
    'app/customer/CustomerOperationalPages.tsx',
    'app/broker/loads/page.tsx',
    'app/driver/loads/page.tsx',
  ])('%s uses the shared Loads card renderer', (file) => {
    expect(read(file)).toContain('CxLoadCard');
  });

  it.each([
    'app/components/workspace/CompanyMarketplaceExchange.tsx',
    'app/customer/quotes/CustomerQuotesCxPage.tsx',
    'app/broker/bids/page.tsx',
    'app/driver/quotes/page.tsx',
  ])('%s uses the shared Quotes card renderer', (file) => {
    expect(read(file)).toContain('CxQuoteCard');
  });

  it.each([
    'app/customer/diary/page.tsx',
    'app/broker/diary/page.tsx',
    'app/driver/history/page.tsx',
  ])('%s uses the shared Diary card renderer', (file) => {
    expect(read(file)).toContain('CxDiaryCard');
  });

  it('keeps Admin Diary on the approved shared Diary renderer through OperationsDiaryPage', () => {
    expect(read('app/admin/diary/page.tsx')).toContain('<OperationsDiaryPage />');
    expect(read('app/components/workspace/OperationsDiaryPage.tsx')).toContain('CxDiaryCard');
  });

  it('shared renderers preserve the approved fixture class anatomy', () => {
    const loads = read('app/components/workspace/CxLoadCard.tsx');
    const quotes = read('app/components/workspace/CxQuoteCard.tsx');
    const diary = read('app/components/workspace/CxDiaryCard.tsx');
    for (const token of ['xdrive-cx-load-card__route', 'xdrive-cx-load-card__times', 'xdrive-cx-load-card__status', 'xdrive-cx-load-footer']) expect(loads).toContain(token);
    for (const token of ['xdrive-cx-quote-card__route', 'xdrive-cx-quote-card__times', 'xdrive-cx-quote-card__status', 'xdrive-cx-quote-card__footer']) expect(quotes).toContain(token);
    for (const token of ['xdrive-cx-diary-card__route', 'xdrive-cx-diary-card__times', 'xdrive-cx-diary-card__status', 'xdrive-cx-diary-card__footer']) expect(diary).toContain(token);
  });
});
