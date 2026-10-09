import { describe, expect, it } from 'vitest';
import {
  BIDDER_QUOTE_TABS,
  POSTER_QUOTE_TABS,
  canonicalQuoteStage,
  isTerminalQuoteStage,
} from '../lib/quotes/canonicalQuote';

describe('canonical quote lifecycle', () => {
  it('keeps database status authoritative while deriving viewed and shortlisted display stages', () => {
    expect(canonicalQuoteStage({ status: 'submitted' }, 'poster')).toBe('submitted');
    expect(canonicalQuoteStage({ status: 'submitted', viewed_at: '2026-10-09T00:00:00Z' }, 'poster')).toBe('viewed');
    expect(canonicalQuoteStage({ status: 'submitted', shortlisted_at: '2026-10-09T00:00:00Z' }, 'poster')).toBe('shortlisted');
  });

  it('maps legacy rejected/declined states to unsuccessful without mutating the authoritative bid status', () => {
    expect(canonicalQuoteStage({ status: 'rejected' }, 'poster')).toBe('unsuccessful');
    expect(canonicalQuoteStage({ status: 'declined' }, 'bidder')).toBe('unsuccessful');
    expect(canonicalQuoteStage({ status: 'withdrawn' }, 'bidder')).toBe('withdrawn');
  });

  it('keeps archive state perspective-specific', () => {
    const quote = { status: 'accepted', poster_archived_at: '2026-10-09T00:00:00Z' };
    expect(canonicalQuoteStage(quote, 'poster')).toBe('archived');
    expect(canonicalQuoteStage(quote, 'bidder')).toBe('accepted');
  });

  it('derives expiry from the related job lifecycle for active quotes', () => {
    expect(canonicalQuoteStage({ status: 'submitted' }, 'bidder', { jobExpired: true })).toBe('expired');
    expect(isTerminalQuoteStage('expired')).toBe(true);
  });

  it('publishes canonical tab contracts for poster and bidder views', () => {
    expect(POSTER_QUOTE_TABS.map((tab) => tab.id)).toEqual(['received', 'shortlisted', 'accepted', 'unsuccessful', 'archived']);
    expect(BIDDER_QUOTE_TABS.map((tab) => tab.id)).toEqual(['submitted', 'accepted', 'unsuccessful', 'withdrawn', 'expired', 'archived']);
  });
});
