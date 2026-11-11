import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  availabilityStatus: 'available',
  activeAssignments: [] as Array<{ id: string }>,
  assignmentsError: null as { message: string } | null,
  presence: null as Record<string, unknown> | null,
  deleteError: null as { message: string } | null,
  deleted: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  jobsLookup: vi.fn(),
  presenceLookup: vi.fn(),
}));

vi.mock('../app/api/driver/_lib/webDriverContext', () => ({
  requireActiveWebDriver: vi.fn(async () => ({
    userId: 'user-1',
    driverId: 'driver-1',
    companyId: 'company-1',
  })),
  isWebDriverContext: (value: unknown) =>
    typeof value === 'object' && value !== null && 'driverId' in value,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'drivers') {
        const query = {
          eq: vi.fn(() => query),
          maybeSingle: async () => ({
            data: {
              id: 'driver-1',
              company_id: 'company-1',
              availability_status: state.availabilityStatus,
            },
            error: null,
          }),
        };
        return { select: () => query };
      }
      if (table === 'jobs') {
        const query = {
          eq: vi.fn(() => query),
          or: vi.fn(() => query),
          limit: state.jobsLookup,
        };
        return { select: () => query };
      }
      if (table === 'driver_availability_presence') {
        const query = {
          eq: vi.fn(() => query),
          maybeSingle: state.presenceLookup,
        };
        return {
          select: () => query,
          delete: () => ({ eq: state.deleted }),
          upsert: state.upsert,
          update: () => ({ eq: state.update }),
        };
      }
      throw new Error(`Unexpected database table: ${table}`);
    },
  },
}));

import { GET, POST, PUT, DELETE } from '../app/api/driver/availability-presence/route';

const request = (method: 'GET' | 'POST' | 'PUT' | 'DELETE') =>
  new NextRequest('http://localhost/api/driver/availability-presence', {
    method,
    ...(method === 'POST' || method === 'PUT'
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: 51.5, lng: -0.13, visibility: 'exchange', hours: 2 }) }
      : {}),
  });

beforeEach(() => {
  state.availabilityStatus = 'available';
  state.activeAssignments = [];
  state.assignmentsError = null;
  state.deleteError = null;
  state.presence = null;
  state.deleted.mockReset();
  state.upsert.mockReset();
  state.update.mockReset();
  state.jobsLookup.mockReset();
  state.presenceLookup.mockReset();
  state.deleted.mockImplementation(async () => ({ error: state.deleteError }));
  state.jobsLookup.mockImplementation(async () => ({
    data: state.activeAssignments,
    error: state.assignmentsError,
  }));
  state.presenceLookup.mockImplementation(async () => ({
    data: state.presence,
    error: null,
  }));
  state.upsert.mockResolvedValue({ error: null });
  state.update.mockResolvedValue({ error: null });
});

describe('driver availability presence prevents active-job tracking', () => {
  it('revokes stale presence and hides it on GET for an active assigned job', async () => {
    state.activeAssignments = [{ id: 'active-job' }];
    state.presence = { visibility: 'exchange', available_until: '2099-01-01T00:00:00Z' };

    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: false, presence: null });
    expect(state.deleted).toHaveBeenCalledWith('driver_id', 'driver-1');
    expect(state.presenceLookup).not.toHaveBeenCalled();
  });

  it('refuses to activate availability when assigned active work exists', async () => {
    state.activeAssignments = [{ id: 'allocated-job' }];

    const response = await POST(request('POST'));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('active assigned job');
    expect(state.deleted).toHaveBeenCalled();
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it('refuses to refresh exact position while an active job exists', async () => {
    state.activeAssignments = [{ id: 'loaded-job' }];

    const response = await PUT(request('PUT'));
    expect(response.status).toBe(409);
    expect(state.deleted).toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });

  it('fails closed on assignment lookup errors without publishing coordinates', async () => {
    state.assignmentsError = { message: 'database unavailable' };

    const response = await POST(request('POST'));
    expect(response.status).toBe(503);
    expect(state.upsert).not.toHaveBeenCalled();
    expect(state.deleted).not.toHaveBeenCalled();
    const readResponse = await GET(request('GET'));
    expect(readResponse.status).toBe(503);
    expect(state.presenceLookup).not.toHaveBeenCalled();
  });

  it('allows eligible opted-in drivers and rounds public Exchange coordinates', async () => {
    const response = await POST(request('POST'));
    expect(response.status).toBe(200);
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        driver_id: 'driver-1',
        exchange_lat: 51.5,
        exchange_lng: -0.13,
        exact_lat: 51.5,
        exact_lng: -0.13,
      }),
      { onConflict: 'driver_id' },
    );
  });

  it('clears presence when the driver is no longer available', async () => {
    state.availabilityStatus = 'unavailable';
    const response = await POST(request('POST'));
    expect(response.status).toBe(409);
    expect(state.deleted).toHaveBeenCalled();
    expect(state.jobsLookup).not.toHaveBeenCalled();
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it('lets a driver stop sharing even if an active job is assigned', async () => {
    state.activeAssignments = [{ id: 'active-job' }];
    const response = await DELETE(request('DELETE'));
    expect(response.status).toBe(200);
    expect(state.deleted).toHaveBeenCalled();
    expect(state.jobsLookup).not.toHaveBeenCalled();
  });
});
