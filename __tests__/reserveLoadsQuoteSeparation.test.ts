import { describe, expect, it } from 'vitest';
import { reserveJobs, reserveCounts } from '../driver-pwa-reserve/src/reserveLists';
import type { LiveJob } from '../driver-pwa-reserve/src/liveApi';

const load = (id: string, extra: Partial<LiveJob> = {}): LiveJob => ({
  id, from: 'Blackburn', to: 'Oldham', pickup: '08:00', delivery: '12:00',
  vehicle: 'lwb_van', weight: 100, notes: '', status: 'OPEN',
  marketplaceListed: true, ...extra,
});

describe('Driver PWA: quoted loads belong to Quotes, not Loads', () => {
  const unquoted = load('unquoted');
  const quoted = load('quoted', { quote: 13, bidStatus: 'submitted', personalBid: true, bidId: 'bid1' });
  const quotedFeedFallback = load('feed-quote', { quote: 15, bidStatus: 'submitted', bidId: 'bid2' });
  const withdrawn = load('withdrawn', { quote: 12, bidStatus: 'withdrawn', quoteOutcome: 'CANCELLED', personalBid: true, bidId: 'bid3' });
  const awarded = load('awarded', { quote: 11, bidStatus: 'accepted', quoteOutcome: 'AWARDED', personalBid: true, bidId: 'bid4' });
  const otherDriverUnquoted = load('other-driver-unquoted');
  const notMarketplace = load('nonmarket', { marketplaceListed: false });
  const allocated = load('allocated', { status: 'ALLOCATED' });
  const jobs = [unquoted, quoted, quotedFeedFallback, withdrawn, awarded, otherDriverUnquoted, notMarketplace, allocated];

  it('never repeats the own active quote in Loads', () => {
    expect(reserveJobs(jobs, 'Loads').map(j => j.id)).toEqual(['unquoted', 'withdrawn', 'other-driver-unquoted']);
  });
  it('preserves submitted, awarded, and withdrawn quote destinations', () => {
    expect(reserveJobs(jobs, 'Quotes').map(j => j.id)).toEqual(['quoted']);
    expect(reserveJobs(jobs, 'Quotes', '', 'All', 'Awarded').map(j => j.id)).toEqual(['awarded']);
    expect(reserveJobs(jobs, 'Quotes', '', 'All', 'History').map(j => j.id)).toEqual(['withdrawn']);
  });
  it('keeps a withdrawn quote eligible for Loads only while marketplace listed and open', () => {
    const closed = load('closed', { quote: 13, bidStatus: 'withdrawn', quoteOutcome: 'CANCELLED', status: 'ALLOCATED' });
    const unlisted = load('unlisted', { quote: 13, bidStatus: 'withdrawn', quoteOutcome: 'CANCELLED', marketplaceListed: false });
    expect(reserveJobs([closed, unlisted, withdrawn], 'Loads').map(j => j.id)).toEqual(['withdrawn']);
  });
  it('keeps counts consistent with the separated opportunity view', () => {
    const counts = reserveCounts(jobs);
    expect(counts.unquoted).toBe(3);
    expect(counts.quoted).toBe(3);
  });
});
