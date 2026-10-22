import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');

describe('CX-density Loads and Quotes workspaces', () => {
  it('keeps Loads as a filter-sidebar plus operational result-card workspace', () => {
    expect(source).toContain('Search Loads');
    expect(source).toContain('Advanced Search');
    expect(source).toContain('className="carrier-exchange-rail"');
    expect(source).not.toContain("flex: '0 0 185px'");
    expect(source).toContain('Quote Now');
    expect(source).toContain('Load Notes:');
    expect(source).toContain('View Details');
    expect(source).toContain('List View');
    expect(source).toContain('Interactive Freight Radar Map');
    expect(source).toContain('cx-expand-entries-control');
  });

  it('keeps all real marketplace search capabilities available after compaction', () => {
    for (const field of ['Minimum vehicle size','Maximum vehicle size','Job Description','Posted within','Pickup from','Pickup to','Budget','Recent searches','Save Default']) {
      expect(source).toContain(field);
    }
    expect(source).toContain('loadLoads(1, true)');
    expect(source).toContain('marketplaceVehicleSizeRank');
  });

  it('renders the dedicated Quotes route without Marketplace KPI/navigation duplication', () => {
    expect(source).toContain("initialTab?: 'loads' | 'bids' | 'won'");
    expect(source).toContain("const [tab] = useState<'loads' | 'bids' | 'won'>(initialTab)");
    expect(source).toContain("{tab === 'bids' && <div");
    expect(source).toContain('Search Panel');
    expect(source).toContain('Pickup Time Within');
    expect(source).toContain('Delivery Time Within');
    expect(source).toContain('Load ID / Ref');
    expect(source).toContain('Booked by');
  });

  it('preserves real quote lifecycle actions and privacy-safe data', () => {
    expect(source).toContain("const activeQuote = ['submitted', 'viewed', 'shortlisted'].includes(stage)");
    expect(source).toContain('Cancel Quote');
    expect(source).toContain('quoteMessage');
    expect(source).not.toContain('Private execution contact');
  });
});
