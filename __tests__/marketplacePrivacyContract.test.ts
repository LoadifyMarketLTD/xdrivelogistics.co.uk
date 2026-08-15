import { describe, expect, it } from 'vitest';
import {
  proposedPriceAmount,
  publicOutcode,
  publicQuoteNotes,
  quoteSafeRequirementFlags,
} from '../app/api/driver/_lib/marketplacePublic';

describe('Marketplace pre-award privacy contract', () => {
  it('reduces UK postcodes to the outward area', () => {
    expect(publicOutcode('BB1 9QL')).toBe('BB1');
    expect(publicOutcode('SW1A 1AA')).toBe('SW1A');
  });

  it('never exposes legacy free-text load_details as public quote notes', () => {
    expect(publicQuoteNotes('Gate code 4281, ask for John at loading bay 4')).toBeNull();
  });

  it('exposes only an explicitly separated publicQuoteNotes value', () => {
    expect(publicQuoteNotes(JSON.stringify({
      publicQuoteNotes: 'Call dispatcher before quoting.',
      executionInstructions: 'Gate code 4281.',
    }))).toBe('Call dispatcher before quoting.');
  });

  it('keeps XDrive proposed-price semantics independent from legacy fixed-price metadata', () => {
    expect(proposedPriceAmount(260)).toBe(260);
    expect(proposedPriceAmount('35.00')).toBe(35);
    expect(proposedPriceAmount(0)).toBeNull();
  });

  it('projects only recognised quote-safe handling flags from mixed legacy requirements', () => {
    const flags = quoteSafeRequirementFlags({
      collection_tail_lift_required: true,
      special_requirements: 'ADR Required; Gate code 9931; Fragile Goods',
    });
    expect(flags).toContain('Tail lift');
    expect(flags).toContain('ADR');
    expect(flags).toContain('Fragile');
    expect(flags.join(' ')).not.toContain('9931');
    expect(flags.join(' ').toLowerCase()).not.toContain('gate code');
  });
});
