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

  it('uses Loads as the page identity and leaves Quotes to the primary route', () => {
    expect(exchange).toContain("title={dedicatedQuotes ? 'Quotes' : 'Loads'}");
    expect(exchange).not.toContain("tabButton('bids', 'My Quotes')");
    expect(exchange).not.toContain('Marketplace operational signals');
    expect(exchange).toContain("tabButton('won', 'Won Work')");
  });
});
