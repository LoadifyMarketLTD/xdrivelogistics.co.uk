import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const assertAnatomy = (source: string, tokens: string[]) => {
  for (const token of tokens) expect(source).toContain(token);
};

describe('Loads Quotes Diary share the approved CX visual identity across operational workspaces', () => {
  const loadsAnatomy = ['xdrive-cx-load-card', 'xdrive-cx-load-card__main', 'xdrive-cx-load-card__route', 'xdrive-cx-load-card__times', 'xdrive-cx-load-card__status'];
  const quotesAnatomy = ['xdrive-cx-quote-card', 'xdrive-cx-quote-card__main', 'xdrive-cx-quote-card__route', 'xdrive-cx-quote-card__times', 'xdrive-cx-quote-card__status', 'xdrive-cx-quote-card__footer'];
  const diaryAnatomy = ['xdrive-cx-diary-card', 'xdrive-cx-diary-card__main', 'xdrive-cx-diary-card__route', 'xdrive-cx-diary-card__times', 'xdrive-cx-diary-card__status', 'xdrive-cx-diary-card__footer'];

  it('keeps the approved fixture Loads anatomy and centralizes role pages on it', () => {
    expect(read('app/components/workspace/CompanyMarketplaceExchange.tsx')).toContain('CxLoadCard');
    assertAnatomy(read('app/components/workspace/CxLoadCard.tsx'), loadsAnatomy);
    for (const file of ['app/driver/loads/page.tsx', 'app/broker/loads/page.tsx', 'app/customer/CustomerOperationalPages.tsx']) {
      expect(read(file)).toContain('CxLoadCard');
    }
  });

  it('keeps the approved fixture Quotes anatomy and centralizes role pages on it', () => {
    expect(read('app/components/workspace/CompanyMarketplaceExchange.tsx')).toContain('CxQuoteCard');
    assertAnatomy(read('app/components/workspace/CxQuoteCard.tsx'), quotesAnatomy);
    for (const file of ['app/driver/quotes/page.tsx', 'app/broker/bids/page.tsx', 'app/customer/quotes/CustomerQuotesCxPage.tsx']) {
      expect(read(file)).toContain('CxQuoteCard');
    }
  });

  it('keeps the approved Diary anatomy and centralizes every operational Diary page on it', () => {
    assertAnatomy(read('app/components/workspace/CxDiaryCard.tsx'), diaryAnatomy);
    for (const file of ['app/components/workspace/OperationsDiaryPage.tsx', 'app/driver/history/page.tsx', 'app/broker/diary/page.tsx', 'app/customer/diary/page.tsx']) {
      expect(read(file)).toContain('CxDiaryCard');
    }
  });

  it('keeps Super Admin outside this visual convergence contract', () => {
    const source = read('app/super-admin/layout.tsx');
    expect(source).not.toContain('xdrive-workspace-measured');
  });
});
