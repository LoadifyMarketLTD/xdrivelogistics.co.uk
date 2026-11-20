import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  submit: vi.fn(),
  driver: { driverId: 'synthetic-driver', userId: 'synthetic-user', companyId: 'synthetic-company' },
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({ isSupabaseAdminConfigured: true, supabaseAdmin: {} }));
vi.mock('../app/api/driver/_lib/webDriver', () => ({ requireWebDriver: async () => h.driver }));
vi.mock('../app/api/driver/mobile/_lib', () => ({
  isDriverContext: (value: unknown) => value === h.driver,
  respond: (status: number, body: unknown) => new Response(JSON.stringify(body), {status}),
}));
vi.mock('../app/api/driver/_lib/submitQuote', () => ({ submitDriverQuote: h.submit }));
import { POST } from '../app/api/driver/bids/route';

describe('web driver rich quote transmission', () => {
  beforeEach(() => h.submit.mockReset().mockResolvedValue({ok:true,status:201,bidId:'synthetic-bid',jobId:'synthetic-job'}));
  const call = (body: Record<string, unknown>) => POST(new NextRequest('https://example.invalid/api/driver/bids', {
    method:'POST', body:JSON.stringify({jobId:'synthetic-job',amount:125,baseAmount:100,additionalExtrasGbp:25,message:'Synthetic quote',...body}),
  }));
  it('forwards the structured ETA and all commercial amounts without data loss',async()=>{
    expect((await call({collectWithinMinutes:30})).status).toBe(201);
    expect(h.submit).toHaveBeenCalledWith({}, h.driver, {jobId:'synthetic-job',amount:125,baseAmount:100,additionalExtrasGbp:25,message:'Synthetic quote',collectWithinMinutes:30});
  });
  it('preserves the existing optional ETA contract for older web clients',async()=>{
    expect((await call({})).status).toBe(201);
    expect(h.submit.mock.calls[0][2].collectWithinMinutes).toBeNull();
  });
  it.each(['not-a-time',false,{},4,241,15.5])('rejects malformed or out-of-range ETA %j before quote mutation',async eta=>{
    expect((await call({collectWithinMinutes:eta})).status).toBe(400);
    expect(h.submit).not.toHaveBeenCalled();
  });
});
