import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');

describe('CX carrier Exchange Quote state parity', () => {
  it('exposes operational quote buckets from canonical bid statuses', () => {
    expect(source).toContain("type QuoteStateView = 'all' | 'submitted' | 'accepted' | 'unsuccessful' | 'archived'");
    expect(source).toContain("'Submitted'");
    expect(source).toContain("'Accepted / Won'");
    expect(source).toContain("'Unsuccessful'");
    expect(source).toContain("'Archived'");
  });

  it('derives Archive from withdrawn quotes without inventing a database status', () => {
    expect(source).toContain("quoteStateView === 'archived' && bid.status === 'withdrawn'");
    expect(source).toContain("withdrawn: bids.filter((bid) => bid.status === 'withdrawn').length");
    expect(source).not.toContain("bid.status === 'archived'");
  });

  it('keeps legitimate submitted quote withdrawal available', () => {
    expect(source).toContain("bid.status === 'submitted'");
    expect(source).toContain('withdrawQuote(bid.id)');
  });
});
