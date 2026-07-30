import type { LiveLoad } from '../../api/liveLoads';
import {
  buildDisplayedFeed,
  companyName,
  hideJobPreference,
  restoreJobPreference,
  schedule,
  togglePinPreference,
} from '../liveLoadHelpers';

// ─── Minimal LiveLoad stub ────────────────────────────────────────────────────

function job(id: string, overrides: Partial<LiveLoad> = {}): LiveLoad {
  return {
    id,
    reference: `REF-${id}`,
    pickupLocation: 'Manchester',
    deliveryLocation: 'London',
    pickupTime: '2024-06-01T09:00:00.000Z',
    deliveryTime: '2024-06-01T17:00:00.000Z',
    cargoType: 'Pallets',
    vehicleRequirement: 'Luton Van',
    price: '£250.00',
    proposedPriceAmount: 250,
    publicPricePublished: true,
    canQuote: true,
    pickupCountryCode: 'GB',
    deliveryCountryCode: 'GB',
    directDeliveryRequired: false,
    destinationPriority: false,
    hasProposedPrice: true,
    ...overrides,
  };
}

// ─── companyName ─────────────────────────────────────────────────────────────

describe('companyName', () => {
  it('returns the trimmed posting company name when present', () => {
    expect(companyName(job('j1', { postingCompanyName: '  Acme Logistics  ' }))).toBe('Acme Logistics');
  });

  it('returns the fallback when postingCompanyName is an empty string', () => {
    expect(companyName(job('j1', { postingCompanyName: '' }))).toBe('Verified marketplace member');
  });

  it('returns the fallback when postingCompanyName is a whitespace-only string', () => {
    expect(companyName(job('j1', { postingCompanyName: '   ' }))).toBe('Verified marketplace member');
  });

  it('returns the fallback when postingCompanyName is undefined', () => {
    expect(companyName(job('j1', { postingCompanyName: undefined }))).toBe('Verified marketplace member');
  });

  it('preserves meaningful whitespace within the name', () => {
    expect(companyName(job('j1', { postingCompanyName: 'XDrive Logistics Ltd' }))).toBe('XDrive Logistics Ltd');
  });
});

// ─── schedule ────────────────────────────────────────────────────────────────

describe('schedule', () => {
  it('formats a valid ISO datetime string', () => {
    // Use a fixed UTC instant that has a predictable en-GB representation
    const result = schedule('2024-06-15T09:30:00.000Z');
    // Should contain a day number and a month abbreviation
    expect(result).toMatch(/\d{2}/);
    expect(result).not.toBe('2024-06-15T09:30:00.000Z');
  });

  it('returns the original string when the value is not a valid date', () => {
    expect(schedule('Collection time not set')).toBe('Collection time not set');
    expect(schedule('TBC')).toBe('TBC');
    expect(schedule('')).toBe('');
  });

  it('returns the original string for a clearly invalid ISO value', () => {
    expect(schedule('not-a-date')).toBe('not-a-date');
  });

  it('handles a date-only string without throwing', () => {
    // date-only strings are parsed differently across Node versions — just assert no throw
    expect(() => schedule('2024-06-15')).not.toThrow();
  });
});

// ─── buildDisplayedFeed ──────────────────────────────────────────────────────

describe('buildDisplayedFeed', () => {
  const prefs = { savedJobIds: ['j2', 'j3'], hiddenJobIds: ['j4'] };

  it('live feed excludes hidden jobs', () => {
    const jobs = [job('j1'), job('j2'), job('j3'), job('j4')];
    const result = buildDisplayedFeed('live', jobs, prefs);
    expect(result.map((j) => j.id)).toEqual(['j1', 'j2', 'j3']);
    expect(result.find((j) => j.id === 'j4')).toBeUndefined();
  });

  it('live feed returns all jobs when nothing is hidden', () => {
    const jobs = [job('a'), job('b')];
    const result = buildDisplayedFeed('live', jobs, { savedJobIds: [], hiddenJobIds: [] });
    expect(result).toHaveLength(2);
  });

  it('live feed returns an empty array when all jobs are hidden', () => {
    const jobs = [job('j4')];
    const result = buildDisplayedFeed('live', jobs, prefs);
    expect(result).toHaveLength(0);
  });

  it('pinned feed returns only saved + visible jobs', () => {
    const jobs = [job('j1'), job('j2'), job('j3'), job('j4')];
    const result = buildDisplayedFeed('pinned', jobs, prefs);
    expect(result.map((j) => j.id)).toEqual(['j2', 'j3']);
  });

  it('pinned feed excludes a saved job that is also hidden', () => {
    const mixed = { savedJobIds: ['j4'], hiddenJobIds: ['j4'] };
    const result = buildDisplayedFeed('pinned', [job('j4')], mixed);
    expect(result).toHaveLength(0);
  });

  it('hidden feed returns only hidden jobs', () => {
    const jobs = [job('j1'), job('j2'), job('j4')];
    const result = buildDisplayedFeed('hidden', jobs, prefs);
    expect(result.map((j) => j.id)).toEqual(['j4']);
  });

  it('hidden feed returns an empty array when nothing is hidden', () => {
    const result = buildDisplayedFeed('hidden', [job('j1'), job('j2')], { savedJobIds: [], hiddenJobIds: [] });
    expect(result).toHaveLength(0);
  });

  it('hidden feed can include jobs that are also pinned', () => {
    const mixed = { savedJobIds: ['j1'], hiddenJobIds: ['j1'] };
    const result = buildDisplayedFeed('hidden', [job('j1')], mixed);
    expect(result.map((j) => j.id)).toEqual(['j1']);
  });

  it('preserves job order in the result', () => {
    const jobs = [job('c'), job('a'), job('b')];
    const result = buildDisplayedFeed('live', jobs, { savedJobIds: [], hiddenJobIds: [] });
    expect(result.map((j) => j.id)).toEqual(['c', 'a', 'b']);
  });
});

// ─── togglePinPreference ─────────────────────────────────────────────────────

describe('togglePinPreference', () => {
  it('adds a job to savedJobIds when not already saved', () => {
    const result = togglePinPreference({ savedJobIds: ['a'] }, 'b');
    expect(result.savedJobIds).toEqual(['a', 'b']);
  });

  it('removes a job from savedJobIds when already saved', () => {
    const result = togglePinPreference({ savedJobIds: ['a', 'b', 'c'] }, 'b');
    expect(result.savedJobIds).toEqual(['a', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = { savedJobIds: ['a'] };
    const result = togglePinPreference(input, 'b');
    expect(input.savedJobIds).toEqual(['a']);
    expect(result.savedJobIds).toEqual(['a', 'b']);
  });

  it('produces an empty array when the only saved job is unpinned', () => {
    const result = togglePinPreference({ savedJobIds: ['a'] }, 'a');
    expect(result.savedJobIds).toEqual([]);
  });

  it('second toggle restores the original pin state', () => {
    const initial = { savedJobIds: [] };
    const pinned = togglePinPreference(initial, 'x');
    const unpinned = togglePinPreference(pinned, 'x');
    expect(pinned.savedJobIds).toEqual(['x']);
    expect(unpinned.savedJobIds).toEqual([]);
  });
});

// ─── hideJobPreference ───────────────────────────────────────────────────────

describe('hideJobPreference', () => {
  it('adds a job to hiddenJobIds when not already hidden', () => {
    const result = hideJobPreference({ hiddenJobIds: [] }, 'j1');
    expect(result.hiddenJobIds).toEqual(['j1']);
  });

  it('is idempotent: hiding an already-hidden job leaves the list unchanged', () => {
    const input = { hiddenJobIds: ['j1'] };
    const result = hideJobPreference(input, 'j1');
    expect(result.hiddenJobIds).toBe(input.hiddenJobIds); // same reference
  });

  it('does not affect other hidden jobs', () => {
    const result = hideJobPreference({ hiddenJobIds: ['j1', 'j2'] }, 'j3');
    expect(result.hiddenJobIds).toEqual(['j1', 'j2', 'j3']);
  });

  it('does not mutate the input array when adding a new job', () => {
    const input = { hiddenJobIds: ['j1'] };
    hideJobPreference(input, 'j2');
    expect(input.hiddenJobIds).toEqual(['j1']);
  });
});

// ─── restoreJobPreference ─────────────────────────────────────────────────────

describe('restoreJobPreference', () => {
  it('removes the specified job from hiddenJobIds', () => {
    const result = restoreJobPreference({ hiddenJobIds: ['j1', 'j2', 'j3'] }, 'j2');
    expect(result.hiddenJobIds).toEqual(['j1', 'j3']);
  });

  it('is safe to call when the job is not hidden', () => {
    const result = restoreJobPreference({ hiddenJobIds: ['j1'] }, 'j99');
    expect(result.hiddenJobIds).toEqual(['j1']);
  });

  it('produces an empty list when the only hidden job is restored', () => {
    const result = restoreJobPreference({ hiddenJobIds: ['j1'] }, 'j1');
    expect(result.hiddenJobIds).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = { hiddenJobIds: ['j1', 'j2'] };
    restoreJobPreference(input, 'j1');
    expect(input.hiddenJobIds).toEqual(['j1', 'j2']);
  });

  it('does not affect other hidden jobs', () => {
    const result = restoreJobPreference({ hiddenJobIds: ['j1', 'j2', 'j3'] }, 'j2');
    expect(result.hiddenJobIds).not.toContain('j2');
    expect(result.hiddenJobIds).toContain('j1');
    expect(result.hiddenJobIds).toContain('j3');
  });
});
