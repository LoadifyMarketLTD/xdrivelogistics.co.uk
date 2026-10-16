import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX carrier quote search and expansion parity', () => {
  const page = read('app/components/workspace/CompanyMarketplaceExchange.tsx');
  const api = read('app/api/marketplace/company/route.ts');

  it('exposes the CX quote search controls', () => {
    expect(page).toContain('Pickup Time Within');
    expect(page).toContain('Delivery Time Within');
    expect(page).toContain('Load ID / Ref');
    expect(page).toContain('Booked by');
    expect(page).toContain('QUOTE_TIME_WINDOWS');
  });

  it('keeps the exact CX-live quote buckets and visible-result expand/collapse', () => {
    for (const label of ['Received', 'Archived', 'Submitted', 'Unsuccessful']) expect(page).toContain(label);
    expect(page).not.toContain('Accepted / Won');
    expect(page).toContain('cx-expand-entries-control');
    expect(page).toContain('allVisibleQuotesExpanded');
    expect(page).toContain('toggleAllVisibleQuotes');
    expect(page).toContain('Details');
    expect(page).toContain('Collapse');
  });

  it('uses real pickup and delivery times from the quote load context', () => {
    expect(api).toContain('delivery_datetime: marketplaceText(row.delivery_datetime)');
    expect(api).toContain('pickup_datetime, delivery_datetime');
    expect(page).toContain('bid.job?.delivery_datetime');
  });

  it('keeps submitted quote withdrawal legitimate and unchanged', () => {
    expect(page).toContain("const activeQuote = ['submitted', 'viewed', 'shortlisted'].includes(stage)");
    expect(page).toContain('withdrawQuote(bid.id)');
  });
});
