import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllBookingOfferPages } from '../lib/bookingOfferPages';

afterEach(() => vi.unstubAllGlobals());

describe('booking offer pagination', () => {
  it('loads every page without silently truncating offers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ offers: [{ id: 'a' }], hasMore: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ offers: [{ id: 'b' }], hasMore: false }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAllBookingOfferPages<{ id: string }>('/api/customer/booking-offers', 'token'))
      .resolves.toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      '/api/customer/booking-offers?page=0',
      '/api/customer/booking-offers?page=1',
    ]);
  });

  it('does not show partial history when a later page fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ offers: [{ id: 'a' }], hasMore: true }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Backend unavailable' }) }));
    await expect(fetchAllBookingOfferPages('/api/booking-offers', 'token'))
      .rejects.toThrow('Backend unavailable');
  });
});
