import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const adminMarketplace = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
const sharedQuoteDialog = read('app/components/workspace/MarketplaceQuoteNowDialog.tsx');
const driverQuoteModal = read('app/driver/_components/MarketplaceQuoteModal.tsx');
const driverLoads = read('app/driver/loads/page.tsx');
const driverSearch = read('app/driver/loads/search/page.tsx');
const driverLoadDetail = read('app/driver/loads/[id]/page.tsx');
const driverBidRoute = read('app/api/driver/bids/route.ts');
const baselineCss = read('app/components/workspace/workspace-measured-cx-baseline.css');

describe('Admin Marketplace Quote Now global visual identity contract', () => {
  it('keeps one shared Admin Marketplace Quote Now renderer as the canonical visual model', () => {
    expect(adminMarketplace).toContain("import MarketplaceQuoteNowDialog, { type Canonical3150QuoteMeta } from './MarketplaceQuoteNowDialog'");
    expect(adminMarketplace).toContain('<MarketplaceQuoteNowDialog');
    expect(driverQuoteModal).toContain("import MarketplaceQuoteNowDialog");
    expect(driverQuoteModal).toContain('<MarketplaceQuoteNowDialog');

    for (const token of [
      'CANONICAL_3150_QUOTE_TABS.map',
      'className="xd-quote-panel"',
      'className="xd-quote-route"',
      'className="xd-quote-form"',
      'Currency<select',
      '<h3>Your Quote</h3>',
      'xd-quote-commercial-extras',
      'total.toFixed(2)',
      'Notes to Customer (Optional)',
      'Submit Quote',
    ]) {
      expect(sharedQuoteDialog).toContain(token);
    }
  });

  it('uses that one shared renderer on every Driver quote entry surface', () => {
    expect(driverLoads).toContain('MarketplaceQuoteModal');
    expect(driverSearch).toContain('MarketplaceQuoteModal');
    expect(driverLoadDetail).toContain('MarketplaceQuoteModal');

    expect(driverLoads).not.toContain('driver-inline-quote--marketplace"><div className="driver-filter-field"><label>Your quote');
    expect(driverLoadDetail).not.toContain('id="marketplace-quote-amount"');

    expect(sharedQuoteDialog).toContain('className="xd-quote-panel"');
    expect(sharedQuoteDialog).toContain('CANONICAL_3150_QUOTE_TABS.map');
    expect(sharedQuoteDialog).toContain('id="marketplace-quote-vehicle"');
    expect(sharedQuoteDialog).toContain('onCurrencyChange(event.target.value)');
  });

  it('keeps the measured Admin Marketplace styling authoritative for the shared quote modal', () => {
    expect(baselineCss).toContain('.xdrive-workspace-measured .xdrive-quote-modal__member');
    expect(baselineCss).toContain('grid-template-columns: 58px minmax(0, 1fr) 94px;');
    expect(baselineCss).toContain('.xdrive-workspace-measured .xdrive-quote-modal__route > div');
    expect(baselineCss).toContain('.xdrive-workspace-measured .xdrive-quote-modal__total');
    expect(baselineCss).toContain('font-size: 38px !important;');
  });

  it('preserves Driver quote capability while carrying base price and extras separately', () => {
    expect(driverBidRoute).toContain('baseAmount?: unknown;');
    expect(driverBidRoute).toContain('additionalExtrasGbp?: unknown;');
    expect(driverBidRoute).toContain('baseAmount: body?.baseAmount == null ? null : Number(body.baseAmount)');
    expect(driverBidRoute).toContain('additionalExtrasGbp: body?.additionalExtrasGbp == null ? null : Number(body.additionalExtrasGbp)');

    for (const surface of [driverLoads, driverSearch, driverLoadDetail]) {
      expect(surface).toContain('baseAmount: quote.baseAmount');
      expect(surface).toContain('additionalExtrasGbp: quote.additionalExtrasGbp');
      expect(surface).toContain('message: quote.message');
    }
  });
});
