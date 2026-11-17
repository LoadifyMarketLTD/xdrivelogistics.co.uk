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
  it('uses the PR807 live Load cards and reveals freight, commercial and notes only in detail state', () => {
    const pr807Load = read('app/components/workspace/OwnerPR807LoadCard.tsx');
    expect(loads).toContain("import CxLoadCard from '../../components/workspace/OwnerPR807LoadCard'");
    expect(loads).toContain('<CxLoadCard showXDriveContext');
    for (const field of ['freight={<', 'commercial={<', 'notes={<']) expect(loads).toContain(field);
    expect(pr807Load).toContain('details={expanded ? freight : undefined}');
    expect(pr807Load).toContain('requirements={expanded ? commercial : undefined}');
    expect(pr807Load).toContain('showXDriveContext ? <XDriveCardContext');
  });
  it('renders PR807 quote details only when expanded and retains a real Quote modal', () => {
    const pr807Quote = read('app/components/workspace/OwnerPR807QuoteCard.tsx');
    expect(quotes).toContain("import CxQuoteCard from '../../components/workspace/OwnerPR807QuoteCard'");
    expect(quotes).toContain('<CxQuoteCard showXDriveContext');
    expect(quotes).toContain('expandedContent={');
    expect(pr807Quote).toContain('expanded && expandedContent ?');
    expect(pr807Quote).toContain('showXDriveContext ? <XDriveCardContext');
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
