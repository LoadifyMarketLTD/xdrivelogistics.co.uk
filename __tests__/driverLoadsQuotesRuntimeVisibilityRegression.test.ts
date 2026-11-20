import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Driver Loads / Quotes runtime visibility regressions', () => {
  const loads = read('app/driver/loads/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const card = read('app/components/workspace/OwnerPR807LoadCard.tsx');
  const modal = read('app/driver/_components/MarketplaceQuoteModal.tsx');
  const jobs = read('app/driver/jobs/page.tsx');

  it('places load notes, requirements and quote editor on distinct expanded rows', () => {
    expect(loads).toContain('OwnerPR807LoadCard');
    expect(loads).toContain('Load Notes:');
    expect(loads).toContain('Requirements:');
    expect(card).toContain('details={expanded ? freight : undefined}');
    expect(card).toContain('requirements={expanded ? commercial : undefined}');
    expect(card).toContain('expanded && notes');
    expect(loads).toContain('<MarketplaceQuoteModal');
  });

  it('renders canonical quote detail only when a quote is expanded', () => {
    const quoteCard = read('app/components/workspace/OwnerPR807QuoteCard.tsx');
    expect(quotes).toContain('OwnerPR807QuoteCard');
    expect(quotes).toContain('expanded={expanded}');
    expect(quotes).toContain('expandedContent={<>');
    expect(quotes).toContain('Quote Notes:');
    expect(quotes).toContain('xdrive-cx-quote-table__row');
    expect(quotes).toContain("aria-label={expanded ? 'Collapse quote' : 'Expand quote'}");
    expect(quoteCard).toContain('className="xdrive-cx-quote-card"');
    expect(quoteCard).toContain('expanded && expandedContent ? <div className="xdrive-cx-quote-card__expanded-cx">{expandedContent}</div> : null');
    expect(quoteCard).toContain('xdrive-cx-quote-card__footer');
  });

  it('allows a withdrawn quote to become actionable again', () => {
    expect(loads).toContain("load.myBid?.status && load.myBid.status !== 'withdrawn'");
    expect(loads).toContain('!quoted && <button');
    expect(loads).toContain("selectedQuoteLoad.myBid.status !== 'withdrawn'");
    expect(loads).toContain('bidLoadId && !quoteReadOnly');
  });

  it('scopes the marketplace quote modal so expanded My Jobs actions stay inline', () => {
    expect(loads).toContain('<MarketplaceQuoteModal');
    expect(modal).toContain('if (!target) return null');
    expect(modal).toContain('className="xd-driver-quote-fullscreen"');
    expect(modal).toContain('.xd-driver-quote-fullscreen .xdrive3150-live-quote .xd-quote-panel');
    expect(modal).toContain('<MarketplaceQuoteNowDialog');
    expect(jobs).not.toContain('xd-driver-quote-fullscreen');
    expect(jobs).toContain('driver-inline-quote driver-job-actions');
    expect(jobs).not.toContain('driver-inline-quote--marketplace');
  });
});
