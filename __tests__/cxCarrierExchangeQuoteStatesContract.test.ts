import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CompanyMarketplaceExchange.tsx'), 'utf8');
const canonical = fs.readFileSync(path.join(process.cwd(), 'lib/quotes/canonicalQuote.ts'), 'utf8');
const quoteCard = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/CxQuoteCard.tsx'), 'utf8');

describe('CX carrier Exchange Quote state parity', () => {
  it('exposes the exact CX-live four visible quote buckets while grouping terminal lifecycle states', () => {
    expect(source).toContain("type QuoteStateView = 'received' | 'archived' | 'submitted' | 'unsuccessful'");
    for (const label of ['Received', 'Archived', 'Submitted', 'Unsuccessful']) expect(source).toContain(`'${label}'`);
    expect(source).not.toContain("'Accepted / Won'");
    expect(source).toContain("['archived', 'accepted'].includes(stage)");
    expect(source).toContain("['unsuccessful', 'withdrawn', 'expired'].includes(stage)");
  });

  it('derives Archive from canonical stage metadata without inventing a database status', () => {
    expect(source).toContain("['archived', 'accepted'].includes(stage)");
    expect(source).toContain("'archive_bidder'");
    expect(canonical).toContain("quote.bidder_archived_at");
    expect(source).not.toContain("bid.status === 'archived'");
  });

  it('keeps legitimate active-quote cancellation available using CX wording', () => {
    expect(source).toContain("const activeQuote = ['submitted', 'viewed', 'shortlisted'].includes(stage)");
    expect(source).toContain('Cancel Quote');
    expect(source).toContain('withdrawQuote(bid.id)');
  });

  it('renders CX-live quote card semantics rather than using quote lifecycle as the right-hand job band', () => {
    expect(source).toContain('sold={sold}');
    expect(source).toContain('band={serviceLabel}');
    expect(quoteCard).toContain("sold ? 'SOLD' : band");
    expect(source).toContain('You Quoted');
    expect(source).toContain('Your Quote was Unsuccessful');
    expect(source).toContain('Load Notes:');
    expect(source).toContain('View Details');
    expect(source).not.toContain('xdrive-cx-quote-card__band>{quoteStageLabel');
  });
});
