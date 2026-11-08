import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
describe('Driver Loads / Quotes runtime visibility regressions', () => {
  const loads = read('app/driver/loads/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const loadCard = read('app/driver/_components/ApprovedDriverLoadCard.tsx');
  const quoteCard = read('app/driver/_components/ApprovedDriverQuoteCard.tsx');
  const sharedCard = read('app/driver/_components/ApprovedDriverOperationalCard.tsx');
  const canonicalCard = read('app/components/workspace/Master3150Card.tsx');
  const quoteModal = read('app/driver/_components/MarketplaceQuoteModal.tsx');
  const jobs = read('app/driver/jobs/page.tsx');
  it('uses approved shared Load cards with separate expanded freight, commercial and notes', () => {
    expect(loads).toContain('<ApprovedDriverLoadCard');
    expect(loadCard).toContain('freight &&');
    expect(loadCard).toContain('commercial &&');
    expect(loadCard).toContain('notes &&');
    expect(loadCard).toContain('<CxLoadCard');
    expect(sharedCard).toContain('expanded={expanded}');
    expect(canonicalCard).toContain('expanded && expandedContent &&');
  });
  it('renders canonical quote details only when expanded', () => {
    expect(quotes).toContain('<ApprovedDriverQuoteCard');
    expect(quotes).toContain('expandedContent={');
    expect(quoteCard).toContain('<CxQuoteCard');
    expect(quoteCard).toContain('stage={stage} expanded={expanded}');
    expect(sharedCard).toContain('expanded={expanded}');
    expect(canonicalCard).toContain('expanded && expandedContent &&');
  });
  it('allows withdrawn quotes to become actionable again', () => {
    expect(loads).toContain("load.myBid.status !== 'withdrawn'");
  });
  it('isolates marketplace quote dialog from inline My Jobs execution actions', () => {
    expect(loads).toContain('<MarketplaceQuoteModal');
    expect(quoteModal).toContain('<MarketplaceQuoteNowDialog');
    expect(jobs).toContain('driver-inline-quote driver-job-actions');
    expect(jobs).not.toContain('driver-inline-quote--marketplace');
  });
});
