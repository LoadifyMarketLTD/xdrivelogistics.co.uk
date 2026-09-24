import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('CX surgical parity for Driver Loads, Quotes and Diary', () => {
  const loads = read('app/driver/loads/page.tsx');
  const quotes = read('app/driver/quotes/page.tsx');
  const diary = read('app/driver/history/page.tsx');

  it('keeps Loads actions on real Driver routes', () => {
    expect(loads).toContain("router.push('/driver/quotes')");
    expect(loads).toContain("router.push('/driver/won-work')");
    expect(loads).toContain("router.push('/driver/freight-vision')");
    expect(loads).toContain('router.push(`/driver/loads/${load.id}`)');
    expect(loads).toContain("fetch('/api/driver/bids'");
    expect(loads).toContain('Interactive Freight Radar Map');
    expect(loads).toContain("useState<RegionFilter>('uk_roi')");
    expect(loads).toContain("setRegionFilter('uk_roi')");
    expect(loads).toContain("['submitted', 'accepted'].includes(String(load.myBid?.status ?? '').toLowerCase())");
  });

  it('matches the CX quote register order and action semantics', () => {
    const received = quotes.indexOf(">Received <");
    const archived = quotes.indexOf(">Archived <");
    const submitted = quotes.indexOf(">Submitted <");
    const unsuccessful = quotes.indexOf(">Unsuccessful <");
    expect(received).toBeGreaterThan(0);
    expect(archived).toBeGreaterThan(received);
    expect(submitted).toBeGreaterThan(archived);
    expect(unsuccessful).toBeGreaterThan(submitted);
    expect(quotes).toContain('Booked by');
    expect(quotes).toContain('View Details');
    expect(quotes).toContain('Cancel Quote');
    expect(quotes).toContain("view.access === 'assigned'");
    expect(quotes).toContain("view.access === 'marketplace'");
    expect(quotes).toContain('setExpandedIds((previous) => new Set(previous).add(bid.id))');
    expect(quotes).toContain('/api/member-profile/${encodeURIComponent(id)}');
    expect(quotes).toContain('companyNames[assigned.company_id]');
  });

  it('keeps Diary CX state tabs and utility actions explicit', () => {
    for (const label of ['All', 'Unallocated', 'Allocated', 'In Progress', 'Completed', 'Cancelled', 'Expired', 'Awaiting Feedback', 'Recent Feedback']) {
      expect(diary).toContain(label);
    }
    expect(diary).toContain("router.push('/driver/directory')");
    expect(diary).toContain('>Contacts</ActionButton>');
    expect(diary).toContain("router.push('/driver/finance')");
    for (const filter of ['Member / Driver', 'Booked by', 'Customer Name']) expect(diary).toContain(filter);
    for (const label of ['POD', 'Order', 'Notes', 'History', 'Documents', 'Invoice']) {
      expect(diary).toContain(`label: '${label}'`);
    }
  });
});
