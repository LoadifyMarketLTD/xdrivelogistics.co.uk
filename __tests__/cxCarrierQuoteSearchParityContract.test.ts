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

  it('keeps quote state buckets and visible-result expand/collapse', () => {
    expect(page).toContain('Accepted / Won');
    expect(page).toContain('Unsuccessful');
    expect(page).toContain('Archived');
    expect(page).toContain('OperationalExpandAllControl');
    expect(page).toContain('allVisibleQuotesExpanded');
    expect(page).toContain('Details');
    expect(page).toContain('Collapse');
  });

  it('uses real pickup and delivery times from the quote load context', () => {
    expect(api).toContain('delivery_datetime: marketplaceText(row.delivery_datetime)');
    expect(api).toContain('pickup_datetime, delivery_datetime');
    expect(page).toContain('bid.job?.delivery_datetime');
  });

  it('keeps submitted quote withdrawal legitimate and unchanged', () => {
    expect(page).toContain("bid.status === 'submitted'");
    expect(page).toContain('withdrawQuote(bid.id)');
  });
});
