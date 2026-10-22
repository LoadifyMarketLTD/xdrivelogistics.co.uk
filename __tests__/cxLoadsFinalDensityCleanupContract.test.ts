import fs from 'node:fs';
import path from 'node:path';

const layout = fs.readFileSync(path.join(process.cwd(), 'app/admin/marketplace/layout.tsx'), 'utf8');
const exchange = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');

describe('final Loads density cleanup', () => {
  it('does not render a second Marketplace / Directory navigation row below the main navbar', () => {
    expect(layout).not.toContain('Carrier marketplace views');
    expect(layout).not.toContain('Marketplace = available work');
    expect(layout).toContain('return children');
  });

  it('keeps Loads, Quotes and Won Work route-selected instead of rendering duplicate local navigation', () => {
    expect(exchange).toContain("initialTab?: 'loads' | 'bids' | 'won'");
    expect(exchange).toContain("const [tab] = useState<'loads' | 'bids' | 'won'>(initialTab)");
    expect(exchange).toContain("{tab === 'loads' && <>");
    expect(exchange).toContain("{tab === 'bids' && <div");
    expect(exchange).toContain("{tab === 'won' && <div");
    expect(exchange).not.toContain("tabButton('bids', 'My Quotes')");
    expect(exchange).not.toContain('Marketplace operational signals');
  });
});
