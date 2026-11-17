import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  active: true,
  driverType: 'owner_driver',
  appAccess: true,
  memberActive: true,
  companyStatus: 'active',
  accessed: [] as string[],
  filters: [] as Array<[string, string, unknown]>,
  jobs: [] as Array<Record<string, unknown>>,
}));
vi.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, opts?: { status?: number }) => ({
    status: opts?.status ?? 200, body,
  }) },
}));
vi.mock('../app/api/driver/_lib/webDriverContext', () => ({
  requireActiveWebDriver: async () => state.active
    ? { userId: 'user-owner', driverId: 'driver-owner', companyId: 'company-owner' }
    : { status: 401, body: { error: 'Unauthorized' } },
  isWebDriverContext: (value: { userId?: string }) => Boolean(value.userId),
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from(name: string) {
      state.accessed.push(name);
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          state.filters.push([name, column, value]); return query;
        },
        maybeSingle: async () => ({
          data: name === 'drivers' ? {
            id: 'driver-owner', driver_type: state.driverType, app_access: state.appAccess, company_id: 'company-owner',
          } : name === 'company_memberships' ? (state.memberActive ? { id: 'membership-owner' } : null) :
            name === 'companies' ? { id: 'company-owner', status: state.companyStatus } : null,
          error: null,
        }),
        order: () => query,
        limit: async () => ({ data: state.jobs, error: null }),
      };
      return query;
    },
  },
}));
import { GET } from '../app/api/driver/posted-loads/route';

describe('Owner Driver posted-loads API access boundary', () => {
  beforeEach(() => {
    state.active = true;
    state.driverType = 'owner_driver';
    state.appAccess = true;
    state.memberActive = true;
    state.companyStatus = 'active';
    state.accessed.length = 0;
    state.filters.length = 0;
    state.jobs = [];
  });
  const run = () => GET({} as Parameters<typeof GET>[0]);
  it('rejects unauthenticated reads without accessing jobs', async () => {
    state.active = false;
    const response = await run();
    expect(response.status).toBe(401);
    expect(state.accessed).not.toContain('jobs');
  });
  it('denies normal drivers and owner drivers without approved app access', async () => {
    state.driverType = 'company_driver';
    expect((await run()).status).toBe(403);
    expect(state.accessed).not.toContain('jobs');
    state.driverType = 'owner_driver'; state.appAccess = false; state.accessed.length = 0;
    expect((await run()).status).toBe(403);
    expect(state.accessed).not.toContain('jobs');
  });
  it('denies absent active owner membership and inactive companies', async () => {
    state.memberActive = false;
    expect((await run()).status).toBe(403);
    expect(state.accessed).not.toContain('jobs');
    state.memberActive = true; state.companyStatus = 'suspended'; state.accessed.length = 0;
    expect((await run()).status).toBe(403);
    expect(state.accessed).not.toContain('jobs');
  });
  it('allows only exact owner-created jobs within the verified company', async () => {
    state.jobs = [
      { id: 'own-private-draft', company_id: 'company-owner', created_by: 'user-owner', status: 'draft' },
      { id: 'different-company', company_id: 'company-other', created_by: 'user-owner', status: 'draft' },
      { id: 'other-creator', company_id: 'company-owner', created_by: 'user-other', status: 'posted' },
    ];
    const response = await run();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ jobs: [state.jobs[0]] });
    expect(state.filters).toContainEqual(['jobs', 'company_id', 'company-owner']);
    expect(state.filters).toContainEqual(['jobs', 'created_by', 'user-owner']);
    expect(state.filters).toContainEqual(['company_memberships', 'role_in_company', 'owner']);
    expect(state.filters).toContainEqual(['company_memberships', 'status', 'active']);
  });
});