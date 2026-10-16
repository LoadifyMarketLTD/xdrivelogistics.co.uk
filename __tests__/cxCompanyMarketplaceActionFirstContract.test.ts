import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');

describe('CX-close Company Marketplace composition', () => {
  it('keeps the Loads board dense by removing KPI and duplicate marketplace chrome', () => {
    expect(source).not.toContain('OperationalSignalStrip');
    expect(source).not.toContain('ExchangeKpiStrip');
    expect(source).not.toContain('<KpiCard');
    expect(source).toContain("initialTab?: 'loads' | 'bids' | 'won'");
  });

  it('keeps Loads, Quotes and Won Work route-selected instead of duplicating local navigation', () => {
    expect(source).toContain("const [tab] = useState<'loads' | 'bids' | 'won'>(initialTab)");
    expect(source).toContain("{tab === 'loads' && <>");
    expect(source).toContain("{tab === 'bids' && <div");
    expect(source).toContain("{tab === 'won' && <div");
    expect(source).not.toContain("tabButton('bids', 'My Quotes')");
    expect(source).toContain('ariaLabel="Submit marketplace quote"');
    expect(source).toContain('Submit Quote');
  });

  it('keeps List View / Map View and global expansion on operational loads', () => {
    expect(source).toContain('cx-expand-entries-control');
    expect(source).toContain('toggleExpandAll');
    expect(source).toContain('List View');
    expect(source).toContain('Interactive Freight Radar Map');
    expect(source).toContain('<MarketplaceLoadMap');
  });

  it('keeps On Demand / Regular Load / Daily Hire deterministic without timer-based state races', () => {
    expect(source).toContain("['on_demand', 'On Demand']");
    expect(source).toContain("['regular_load', 'Regular Load']");
    expect(source).toContain("['daily_hire', 'Daily Hire']");
    expect(source).toContain("onClick={() => setFilter('loadType', value)}");
    expect(source).not.toContain('setTimeout(() => void loadLoads');
  });

  it('does not introduce Super Admin coupling', () => {
    expect(source).not.toContain('/super-admin');
  });
});
