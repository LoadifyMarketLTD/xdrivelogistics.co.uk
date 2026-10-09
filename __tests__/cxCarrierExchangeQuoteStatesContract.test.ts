import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');
const canonical = fs.readFileSync(path.join(process.cwd(), 'lib/quotes/canonicalQuote.ts'), 'utf8');

describe('CX carrier Exchange Quote state parity', () => {
  it('exposes operational quote buckets from the canonical quote lifecycle', () => {
    expect(source).toContain("type QuoteStateView = 'all' | 'submitted' | 'accepted' | 'unsuccessful' | 'withdrawn' | 'expired' | 'archived'");
    expect(source).toContain("'Submitted'");
    expect(source).toContain("'Accepted / Won'");
    expect(source).toContain("'Unsuccessful'");
    expect(source).toContain("'Withdrawn'");
    expect(source).toContain("'Expired'");
    expect(source).toContain("'Archived'");
  });

  it('derives Archive from bidder-specific metadata without inventing a database status', () => {
    expect(source).toContain("bidStage(bid) === 'archived'");
    expect(source).toContain("'archive_bidder'");
    expect(canonical).toContain("quote.bidder_archived_at");
    expect(source).not.toContain("bid.status === 'archived'");
  });

  it('keeps legitimate submitted quote withdrawal available', () => {
    expect(source).toContain("bid.status === 'submitted'");
    expect(source).toContain('withdrawQuote(bid.id)');
  });
});
