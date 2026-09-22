import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');

describe('CX-density Loads and Quotes workspaces', () => {
  it('keeps Loads as a filter-sidebar plus operational result-card workspace', () => {
    expect(source).toContain('Search Loads');
    expect(source).toContain('Advanced Search');
    expect(source).toContain("flex: '0 1 250px'");
    expect(source).toContain('Quote Now');
    expect(source).toContain('Load Notes:');
    expect(source).toContain('Open Route');
    expect(source).toContain('List View');
    expect(source).toContain('Map View');
  });

  it('keeps all real marketplace search capabilities available after compaction', () => {
    for (const field of ['Minimum vehicle','Maximum vehicle','Job timing','Posted within','Pickup from','Pickup to','Budget','Recent searches','Save Default']) {
      expect(source).toContain(field);
    }
    expect(source).toContain('loadLoads(1, true)');
    expect(source).toContain('marketplaceVehicleSizeRank');
  });

  it('renders the dedicated Quotes route without Marketplace KPI/navigation duplication', () => {
    expect(source).toContain("const dedicatedQuotes = initialTab === 'bids'");
    expect(source).toContain("title={dedicatedQuotes ? 'Quotes' : 'Marketplace'}");
    expect(source).toContain('{!dedicatedQuotes && <>');
    expect(source).toContain('Search Panel');
    expect(source).toContain('Pickup Time Within');
    expect(source).toContain('Delivery Time Within');
    expect(source).toContain('Load ID / Ref');
    expect(source).toContain('Booked by');
  });

  it('preserves real quote lifecycle actions and privacy-safe data', () => {
    expect(source).toContain("bid.status === 'submitted'");
    expect(source).toContain('Withdraw');
    expect(source).toContain('Commercial note');
    expect(source).not.toContain('Private execution contact');
  });
});
