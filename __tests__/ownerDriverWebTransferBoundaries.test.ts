import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const state = vi.hoisted(() => ({
  actor: { userId: 'owner-a', driverId: 'driver-a', companyId: 'company-a' },
  denied: false,
  errors: new Set<string>(),
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{table: string; value: Record<string, unknown>}>,
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let patch: Record<string, unknown> | null = null;
      let limit = Infinity;
      const result = (single: boolean) => {
        if (state.errors.has(table)) return { data: null, error: {message: 'fixture error'} };
        const rows = (state.tables[table] ?? []).filter(row => filters.every(([key,value]) => row[key] === value)).slice(0,limit);
        if (patch && rows.length) {
          for (const row of rows) Object.assign(row, patch);
          state.writes.push({table,value:patch});
        }
        return {data:single ? rows[0] ?? null : rows,error:null};
      };
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.push([key,value]); return chain; },
        order: () => chain,
        limit: (n: number) => { limit = n; return chain; },
        update: (value: Record<string,unknown>) => { patch=value; return chain; },
        maybeSingle: async () => result(true),
        then: (resolve: (value: unknown)=>unknown) => Promise.resolve(result(false)).then(resolve),
      };
      return chain;
    },
  },
}));
vi.mock('../app/api/driver/_lib/webDriver', () => ({
  requireWebDriver: async () => state.denied ? NextResponse.json({error:'Unauthorized'},{status:401}) : state.actor,
}));
vi.mock('../app/api/driver/mobile/_lib', () => ({
  isDriverContext: (v: object) => 'userId' in v,
}));
vi.mock('../app/api/driver/_lib/webDriverContext', () => ({
  requireActiveWebDriver: async () => state.denied ? NextResponse.json({error:'Unauthorized'},{status:401}) : state.actor,
  isWebDriverContext: (v: object) => 'userId' in v,
}));

import { POST as withdraw } from '../app/api/driver/bids/[id]/withdraw/route';
import { GET as postedLoads } from '../app/api/driver/posted-loads/route';

const withdrawRequest=()=>withdraw(new NextRequest('http://localhost/api/driver/bids/bid-a/withdraw',{method:'POST'}),{params:Promise.resolve({id:'bid-a'})});
const postedRequest=()=>postedLoads(new NextRequest('http://localhost/api/driver/posted-loads'));
beforeEach(()=>{
  state.denied=false;state.errors.clear();state.writes=[];
  state.tables={
    drivers:[{id:'driver-a',user_id:'owner-a',company_id:'company-a',driver_type:'owner_driver',app_access:true}],
    company_memberships:[{id:'membership-a',user_id:'owner-a',company_id:'company-a',role_in_company:'owner',status:'active'}],
    companies:[{id:'company-a',status:'active'}],
    job_bids:[{id:'bid-a',job_id:'job-a',bidder_user_id:'owner-a',bidder_driver_id:'driver-a',status:'submitted'}],
    job_booking_offers:[],
    jobs:[
      {id:'job-a',company_id:'company-a',created_by:'owner-a',status:'posted',awarded_carrier_company_id:null,assigned_company_id:null,assigned_driver_id:null},
      {id:'draft-a',company_id:'company-a',created_by:'owner-a',status:'draft'},
      {id:'other-user',company_id:'company-a',created_by:'owner-b',status:'draft'},
      {id:'other-company',company_id:'company-b',created_by:'owner-a',status:'draft'},
    ],
  };
});
describe('Owner Driver WEB quote withdrawal boundary (mocked server data)',()=>{
  it('withdraws only the verified submitted quote and returns confirmed identity and status',async()=>{
    const response=await withdrawRequest();
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({success:true,bidId:'bid-a',status:'withdrawn'});
    expect(state.tables.job_bids[0].status).toBe('withdrawn');expect(state.writes).toHaveLength(1);
  });
  it('is idempotent for an already withdrawn own quote',async()=>{
    state.tables.job_bids[0].status='withdrawn';
    expect((await withdrawRequest()).status).toBe(200);expect(state.writes).toHaveLength(0);
  });
  it('denies unauthenticated requests',async()=>{
    state.denied=true;expect((await withdrawRequest()).status).toBe(401);expect(state.writes).toHaveLength(0);
  });
  it('does not withdraw a different user quote',async()=>{
    state.tables.job_bids[0].bidder_user_id='owner-b';
    expect((await withdrawRequest()).status).toBe(404);expect(state.writes).toHaveLength(0);
  });
  it('does not withdraw a different driver record',async()=>{
    state.tables.job_bids[0].bidder_driver_id='driver-b';
    expect((await withdrawRequest()).status).toBe(403);expect(state.writes).toHaveLength(0);
  });
  it('requires the booking offer workflow when an offer is pending',async()=>{
    state.tables.job_booking_offers=[{id:'offer-a',bid_id:'bid-a',status:'pending'}];
    const response=await withdrawRequest();expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'PENDING_BOOKING_OFFER'});
    expect(state.writes).toHaveLength(0);
  });
  it('fails closed if booking offers cannot be verified',async()=>{
    state.errors.add('job_booking_offers');expect((await withdrawRequest()).status).toBe(503);expect(state.writes).toHaveLength(0);
  });
  it('does not withdraw an allocated job or accepted quote',async()=>{
    state.tables.jobs[0].assigned_company_id='company-a';
    expect((await withdrawRequest()).status).toBe(409);
    state.tables.jobs[0].assigned_company_id=null;state.tables.job_bids[0].status='accepted';
    expect((await withdrawRequest()).status).toBe(409);expect(state.writes).toHaveLength(0);
  });
});
describe('Owner Driver WEB posted-loads tenant boundary (mocked server data)',()=>{
  it('returns only records belonging to the verified company and creator',async()=>{
    const response=await postedRequest();expect(response.status).toBe(200);
    const body=await response.json();expect(body.jobs.map((job:{id:string})=>job.id)).toEqual(['job-a','draft-a']);
    expect(response.headers.get('cache-control')).toBe('no-store');expect(state.writes).toHaveLength(0);
  });
  it('denies company drivers',async()=>{
    state.tables.drivers[0].driver_type='company_driver';expect((await postedRequest()).status).toBe(403);
  });
  it('denies inactive membership and company',async()=>{
    state.tables.company_memberships[0].status='inactive';expect((await postedRequest()).status).toBe(403);
    state.tables.company_memberships[0].status='active';state.tables.companies[0].status='suspended';expect((await postedRequest()).status).toBe(403);
  });
  it('fails closed on membership query error and unauthenticated request',async()=>{
    state.errors.add('company_memberships');expect((await postedRequest()).status).toBe(503);
    state.denied=true;expect((await postedRequest()).status).toBe(401);expect(state.writes).toHaveLength(0);
  });
});
