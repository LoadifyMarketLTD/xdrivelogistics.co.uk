import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  currentUser: 'issuer-user',
  tables: {} as Record<string, any[]>,
  sign: vi.fn(),
}));

function from(table: string) {
  const filters: Array<(row: any) => boolean> = [];
  let single = false;
  const q: any = {
    select() { return q; },
    eq(key: string, value: any) { filters.push((row) => row[key] === value); return q; },
    order() { return q; },
    maybeSingle() { single = true; return q; },
    single() { single = true; return q; },
    then(resolve: any, reject: any) {
      return Promise.resolve().then(() => {
        const rows = (h.tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        return { data: single ? rows[0] ?? null : rows, error: null };
      }).then(resolve, reject);
    },
  };
  return q;
}

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true,
  getBearerToken: (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null,
  supabaseValidator: {
    auth: {
      getUser: async () => ({ data: { user: { id: h.currentUser } }, error: null }),
    },
  },
  supabaseAdmin: {
    auth: {
      getUser: async () => ({ data: { user: { id: h.currentUser } }, error: null }),
    },
    from: (table: string) => from(table),
    storage: {
      from: () => ({ createSignedUrl: h.sign }),
    },
  },
}));

import { GET as getInvoice } from '../app/api/finance/invoices/[id]/route';
import { GET as getDocumentUrl } from '../app/api/finance/invoice-document-url/route';
import { GET as getDriverInvoice } from '../app/api/driver/finance/invoices/[id]/route';

const invoiceId = '70000000-0000-4000-8000-000000000008';
const params = { params: Promise.resolve({ id: invoiceId }) };
const authRequest = (url: string) =>
  new NextRequest(url, { headers: { authorization: 'Bearer synthetic-preview-session' } });

beforeEach(() => {
  h.currentUser = 'issuer-user';
  h.sign.mockReset();
  h.sign.mockResolvedValue({ data: { signedUrl: 'https://storage.example.test/signed' }, error: null });
  h.tables = {
    invoices: [{
      id: invoiceId,
      company_id: 'supplier',
      supplier_company_id: 'supplier',
      buyer_company_id: 'buyer',
      job_id: null,
      invoice_number: 'PR680-MATRIX',
      status: 'sent',
      payment_status: 'unpaid',
      delivery_state: 'sent',
      amount: 100,
      net_amount: 100,
      client_name: 'Buyer Ltd',
      client_email: 'finance@buyer.example',
    }],
    company_memberships: [
      { user_id: 'issuer-user', company_id: 'supplier', status: 'active', role_in_company: 'owner' },
      { user_id: 'buyer-user', company_id: 'buyer', status: 'active', role_in_company: 'owner' },
      { user_id: 'outsider-user', company_id: 'outsider', status: 'active', role_in_company: 'owner' },
      { user_id: 'dispatcher-user', company_id: 'buyer', status: 'active', role_in_company: 'dispatcher' },
      { user_id: 'employed-driver-user', company_id: 'supplier', status: 'active', role_in_company: 'member' },
    ],
    drivers: [
      { id: 'driver-owner', user_id: 'issuer-user', company_id: 'supplier', status: 'active', app_access: true },
      { id: 'driver-employed', user_id: 'employed-driver-user', company_id: 'supplier', status: 'active', app_access: true },
    ],
    invoice_documents: [{
      id: 'doc-1',
      invoice_id: invoiceId,
      company_id: 'supplier',
      doc_type: 'invoice_pdf',
      file_url: `supplier/${invoiceId}/invoice.pdf`,
      file_name: 'invoice.pdf',
    }],
    invoice_status_history: [],
    invoice_payment_history: [],
    invoice_disputes: [],
  };
});

describe('PR680 downstream invoice access matrix', () => {
  it('allows issuer owner to load the full invoice', async () => {
    h.currentUser = 'issuer-user';
    const response = await getInvoice(authRequest(`https://example.test/api/finance/invoices/${invoiceId}`), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.viewerContext.isIssuer).toBe(true);
  });

  it('allows buyer owner to load only the customer-visible invoice projection', async () => {
    h.currentUser = 'buyer-user';
    const response = await getInvoice(authRequest(`https://example.test/api/finance/invoices/${invoiceId}`), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.viewerContext.isBuyer).toBe(true);
    expect(body.viewerContext.isIssuer).toBe(false);
  });

  it('refuses outsider access', async () => {
    h.currentUser = 'outsider-user';
    const response = await getInvoice(authRequest(`https://example.test/api/finance/invoices/${invoiceId}`), params);
    expect(response.status).toBe(403);
  });

  it('refuses dispatcher access to downstream finance invoice data', async () => {
    h.currentUser = 'dispatcher-user';
    const response = await getInvoice(authRequest(`https://example.test/api/finance/invoices/${invoiceId}`), params);
    expect(response.status).toBe(403);
  });

  it('hides a draft invoice from the buyer', async () => {
    h.currentUser = 'buyer-user';
    Object.assign(h.tables.invoices[0], { status: 'draft', delivery_state: 'idle' });
    const response = await getInvoice(authRequest(`https://example.test/api/finance/invoices/${invoiceId}`), params);
    expect(response.status).toBe(404);
  });

  it('allows issuer and buyer to obtain only a tenant-bound signed document URL', async () => {
    for (const user of ['issuer-user', 'buyer-user']) {
      h.currentUser = user;
      const response = await getDocumentUrl(authRequest(
        `https://example.test/api/finance/invoice-document-url?invoiceId=${invoiceId}&documentId=doc-1`,
      ));
      expect(response.status).toBe(200);
    }
    expect(h.sign).toHaveBeenCalledTimes(2);
  });

  it('refuses outsider and dispatcher document signing', async () => {
    for (const user of ['outsider-user', 'dispatcher-user']) {
      h.currentUser = user;
      const response = await getDocumentUrl(authRequest(
        `https://example.test/api/finance/invoice-document-url?invoiceId=${invoiceId}&documentId=doc-1`,
      ));
      expect(response.status).toBe(403);
    }
  });

  it('allows an active owner-driver finance identity', async () => {
    h.currentUser = 'issuer-user';
    const response = await getDriverInvoice(
      authRequest(`https://example.test/api/driver/finance/invoices/${invoiceId}`),
      params,
    );
    expect(response.status).toBe(200);
  });

  it('refuses an employed driver without owner/admin company role', async () => {
    h.currentUser = 'employed-driver-user';
    const response = await getDriverInvoice(
      authRequest(`https://example.test/api/driver/finance/invoices/${invoiceId}`),
      params,
    );
    expect(response.status).toBe(403);
  });
});
