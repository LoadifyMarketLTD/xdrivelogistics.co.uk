import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queryOps: [] as string[],
  deliverable: false,
  sent: vi.fn(),
  selectedTables: [] as string[],
}));
vi.mock('next/server', () => ({
  NextRequest: class NextRequest {
    constructor(public url: string, public init: unknown) {}
  },
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from(table: string) {
      state.selectedTables.push(table);
      if (table === 'app_settings') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: 'unit-secret' }, error: null }) }) }),
      };
      if (table === 'invoice_delivery_outbox') {
        const q = {
          select: (value: string) => { state.queryOps.push('select:' + value); return q; },
          is: (column: string, value: unknown) => { state.queryOps.push('is:' + column + ':' + String(value)); return q; },
          not: (column: string, op: string, value: unknown) => { state.queryOps.push('not:' + column + ':' + op + ':' + String(value)); return q; },
          lte: (column: string, value: unknown) => { state.queryOps.push('lte:' + column + ':' + String(value)); return q; },
          order: (column: string) => { state.queryOps.push('order:' + column); return q; },
          limit: async () => ({
            data: state.deliverable ? [{ invoice_id: 'invoice-attempted-1' }] : [],
            error: null,
          }),
        };
        return q;
      }
      if (table === 'invoices') return {
        select: () => ({
          eq: () => ({ single: async () => ({
            data: { company_id: 'company-1', created_by: 'invoice-owner-1' }, error: null,
          }) }),
        }),
      };
      throw Error('Unexpected table in worker: ' + table);
    },
  },
}));
vi.mock('../lib/server/invoiceDelivery', () => ({
  submitInvoice: state.sent,
}));
vi.mock('../lib/siteUrl', () => ({
  getCanonicalSiteOrigin: () => 'https://www.xdrivelogistics.co.uk',
}));

import { POST } from '../app/api/internal/invoice-deliveries/route';

function request(secret = 'unit-secret') {
  return { headers: new Headers({ authorization: 'Bearer ' + secret }) } as Parameters<typeof POST>[0];
}
const requiredGuards = [
  'is:completed_at:null',
  'not:payload:is:null',
  'not:first_provider_attempt_at:is:null',
];

describe('Automated invoice delivery worker runtime fail-closed regression', () => {
  beforeEach(() => {
    state.queryOps.length = 0;
    state.selectedTables.length = 0;
    state.deliverable = false;
    state.sent.mockReset();
    state.sent.mockResolvedValue({ status: 200 });
  });
  it('rejects unauthorized requests before reading the invoice queue', async () => {
    const response = await POST(request('incorrect'));
    expect(response.status).toBe(401);
    expect(state.selectedTables).not.toContain('invoice_delivery_outbox');
    expect(state.sent).not.toHaveBeenCalled();
  });
  it('skips a newly generated Draft with no recorded email attempt', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    for (const predicate of requiredGuards) expect(state.queryOps).toContain(predicate);
    expect(state.selectedTables).not.toContain('invoices');
    expect(state.sent).not.toHaveBeenCalled();
    expect(response.body).toEqual({ results: [] });
  });
  it('continues to support retrying a previously attempted explicit delivery', async () => {
    state.deliverable = true;
    const response = await POST(request());
    expect(response.status).toBe(200);
    for (const predicate of requiredGuards) expect(state.queryOps).toContain(predicate);
    expect(state.sent).toHaveBeenCalledTimes(1);
    expect(state.sent.mock.calls[0][1]).toBeDefined();
    expect(state.sent.mock.calls[0][2]).toEqual({
      userId: 'invoice-owner-1',
      companyId: 'company-1',
    });
    expect(response.body).toEqual({ results: [{ invoiceId: 'invoice-attempted-1', status: 200 }] });
  });
});