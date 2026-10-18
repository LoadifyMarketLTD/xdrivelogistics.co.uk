import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { hasCompletePodEvidence } from '../lib/jobs/podCompletion';
import { loadInvoicePdfContext } from '../lib/server/invoicePdfContext';

// In-memory adapter, not a database/RLS/Stripe integration test. Real route handlers run.
const h = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, calls: [] as any[], stripe: vi.fn(), rpc: vi.fn(), sign: vi.fn(), role: 'owner', historyError: false }));
function from(table: string) {
  let op = 'select', values: any, single = false;
  const filters: ((r: any) => boolean)[] = [];
  const q: any = {
    select() { return q; }, or() { return q; }, eq(k: string, v: any) { filters.push(r => r[k] === v); return q; },
    is(k: string, v: any) { filters.push(r => (r[k] ?? null) === v); return q; },
    in(k: string, v: any[]) { filters.push(r => v.includes(r[k])); return q; },
    update(v: any) { op = 'update'; values = v; return q; },
    insert(v: any) { op = 'insert'; values = v; return q; },
    upsert(v: any) { op = 'upsert'; values = v; return q; },
    maybeSingle() { single = true; return q; }, single() { single = true; return q; },
    then(resolve: any, reject: any) {
      return Promise.resolve().then(() => {
        h.calls.push({ table, op, values });
        const rows = h.tables[table] ?? (h.tables[table] = []);
        const matched = rows.filter(r => filters.every(f => f(r)));
        if (table === 'invoice_payment_history' && op === 'insert' && h.historyError) return { data: null, error: { code: 'P0001', message: 'Overpayment rejected' } };
        if (op === 'update') matched.forEach(r => Object.assign(r, values));
        if (op === 'insert') { if (table === 'stripe_webhook_events' && rows.some(r => r.stripe_event_id === values.stripe_event_id)) return { data: null, error: { code: '23505' } }; rows.push({ id: 'generated-id', ...values }); if (single) return { data: rows.at(-1), error: null }; }
        if (op === 'upsert') { const row = rows.find(r => r.invoice_id === values.invoice_id); row ? Object.assign(row, values) : rows.push({ ...values }); }
        return { data: single ? matched[0] ?? null : matched, error: null };
      }).then(resolve, reject);
    },
  };
  return q;
}
vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  isSupabaseAdminConfigured: true, getBearerToken: (r: Request) => r.headers.get('authorization'),
  supabaseValidator: { auth: { getUser: async () => ({ data: { user: { id: 'buyer-user', email: 'user@example.test' } }, error: null }) } },
  supabaseAdmin: { from: (t: string) => from(t), rpc: h.rpc, storage: { from: () => ({ createSignedUrl: h.sign, upload: async () => ({ error: null }), download: async () => ({ data: null, error: { message: 'unavailable' } }) }) } },
}));
vi.mock('../app/api/_lib/stripeServer', () => ({ isStripeServerConfigured: true, stripeRequest: h.stripe, verifyStripeWebhookSignature: () => true }));
vi.mock('../app/api/driver/finance/_lib/financeAccess', () => ({ requireDriverFinanceAccess: async () => ({ ok: true, context: { userId: 'buyer-user', companyId: 'supplier' } }) }));
vi.mock('../lib/server/invoicePdf', () => ({ buildInvoicePdf: async () => new Uint8Array([1, 2, 3]) }));
vi.mock('../app/api/driver/_lib/webDriverContext', () => ({ requireActiveWebDriver: async () => ({ userId: 'buyer-user', driverId: 'driver', companyId: 'supplier' }), isWebDriverContext: () => true }));
vi.mock('../app/api/_lib/platformFlags', () => ({ getFeatureFlag: async () => true, getGlobalSettingNumber: async () => 0 }));
vi.mock('@/lib/financePermissions', async () => await import('../lib/financePermissions'));
import { POST as checkout } from '../app/api/payments/jobs/checkout/route';
import { POST as webhook } from '../app/api/payments/webhooks/connect/route';
import { POST as approve } from '../app/api/admin/invoices/[id]/approve/route';
import { POST as submit } from '../app/api/driver/finance/invoices/[id]/submit/route';
import { POST as generate } from '../app/api/driver/finance/jobs/[jobId]/generate-invoice/route';
import { POST as addDocument } from '../app/api/driver/finance/invoices/[id]/documents/route';
import { GET as documentUrl } from '../app/api/finance/invoice-document-url/route';
import { POST as recordPayment } from '../app/api/admin/invoices/[id]/payment-history/route';
import { PATCH as editDraft } from '../app/api/driver/finance/invoices/[id]/draft/route';

const id = '11111111-1111-4111-8111-111111111111';
const request = (url: string, body: any) => new NextRequest(`https://example.test${url}`, { method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id }) };
const event = (type = 'checkout.session.completed', extra: any = {}) => ({ id: `evt_${h.calls.length}`, type, account: 'acct_supplier', livemode: false, data: { object: { id: 'cs_expected', metadata: { xdrive_invoice_id: id }, payment_status: 'paid', amount_total: 12000, currency: 'gbp', payment_intent: 'pi_expected', ...extra } } });
beforeEach(() => {
  h.calls = []; h.historyError = false; h.stripe.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (name: string) => {
    if (name === 'next_invoice_number') return { data: 'INV-TEST', error: null };
    if (name === 'prepare_invoice_stripe_attempt') return { data: { id: 'attempt-test', amount_minor: 12000, currency: 'gbp', customer_email: 'finance@example.test', return_path: '/customer/invoices/test', status: 'reserved' }, error: null };
    return { data: { received: true }, error: null };
  });
  h.sign.mockReset(); h.sign.mockResolvedValue({ data: { signedUrl: 'https://storage.example.test/signed' }, error: null });
  h.stripe.mockResolvedValue({ id: 'cs_expected', url: 'https://checkout.stripe.test/test' });
  h.tables = {
    invoices: [{ id, company_id: 'supplier', supplier_company_id: 'supplier', buyer_company_id: 'buyer', job_id: 'job', amount: 120, currency: 'GBP', status: 'Approved', approved_at: '2026-10-18', payment_status: 'unpaid', client_email: 'finance@example.test' }],
    company_memberships: [{ user_id: 'buyer-user', company_id: 'buyer', status: 'active', role_in_company: 'owner' }],
    stripe_connected_accounts: [{ company_id: 'supplier', stripe_account_id: 'acct_supplier', charges_enabled: true, payouts_enabled: true, details_submitted: true }],
    stripe_job_payments: [{ invoice_id: id, stripe_connected_account_id: 'acct_supplier', stripe_checkout_session_id: 'cs_expected', status: 'checkout_created' }],
  };
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_local_only';
});

describe('audit: established guards', () => {
  it('rejects Checkout without approval', async () => { h.tables.invoices[0].approved_at = null; expect((await checkout(request('/', { invoiceId: id }))).status).toBe(409); expect(h.stripe).not.toHaveBeenCalled(); });
  it('rejects a dispatcher payment', async () => { h.tables.company_memberships[0].role_in_company = 'dispatcher'; expect((await checkout(request('/', { invoiceId: id }))).status).toBe(403); });
  it('rejects already paid invoice', async () => { h.tables.invoices[0].payment_status = 'paid'; expect((await checkout(request('/', { invoiceId: id }))).status).toBe(409); });
  it('rejects incomplete Connect', async () => { h.tables.stripe_connected_accounts[0].payouts_enabled = false; expect((await checkout(request('/', { invoiceId: id }))).status).toBe(409); });
  it('uses supplier direct charge without application fee', async () => { expect((await checkout(request('/', { invoiceId: id }))).status).toBe(200); expect(h.stripe.mock.calls[0][1].connectedAccount).toBe('acct_supplier'); expect(h.stripe.mock.calls[0][1].params.application_fee_amount).toBeUndefined(); });
  it('rejects approval for another company', async () => { h.tables.company_memberships[0].company_id = 'outsider'; expect((await approve(request('/', {}), params)).status).toBe(403); });
  it('rejects approval of Draft', async () => { Object.assign(h.tables.invoices[0], { status: 'Draft', approved_at: null }); expect((await approve(request('/', {}), params)).status).toBe(409); });
  it('delegates verified transport webhook atomically to the payment RPC', async () => {
    const response = await webhook(request('/', event()));
    expect(response.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith('apply_invoice_stripe_event', expect.objectContaining({ p_expected_live: false }));
    expect(h.tables.invoice_payment_history ?? []).toHaveLength(0);
  });
  it('ignores unrelated Stripe charges without writing an invoice settlement', async () => {
    h.stripe.mockResolvedValue({ id: 'pi_other', metadata: {} });
    expect((await webhook(request('/', event('charge.refunded')))).status).toBe(200);
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('returns an error when the atomic payment transaction rejects', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Stripe amount mismatch' } });
    expect((await webhook(request('/', event()))).status).toBe(500);
  });
});

describe('audit: invoice document tenant isolation', () => {
  it('refuses signing another tenant path attached to own invoice', async () => {
    h.tables.company_memberships[0].company_id = 'supplier';
    const result = await addDocument(request('/', { doc_type: 'invoice_pdf', file_url: 'other-tenant/private-invoice/secret.pdf' }), params);
    expect(result.status).toBe(403);
    h.tables.invoice_documents = [{ id: 'generated-id', invoice_id: id, company_id: 'supplier', file_url: 'other-tenant/private-invoice/secret.pdf' }];
    const response = await documentUrl(new NextRequest(`https://example.test/api/finance/invoice-document-url?invoiceId=${id}&documentId=generated-id`, { headers: { authorization: 'Bearer test' } }));
    expect(response.status).toBe(403); expect(h.sign).not.toHaveBeenCalled();
  });
});

describe('audit: external payment and recipient integrity', () => {
  it('refuses currency different from invoice', async () => { const response = await recordPayment(request('/', { amount: 10, currency: 'USD', idempotency_key: 'external-test' }), params); expect(response.status).toBe(422); });
  it('requires approval before external payment', async () => { h.tables.invoices[0].approved_at = null; h.tables.invoices[0].status = 'Draft'; const response = await recordPayment(request('/', { amount: 10, currency: 'GBP', idempotency_key: 'external-test' }), params); expect(response.status).toBe(409); });
  it('blocks dispatcher from recording an external payment', async () => { h.tables.company_memberships[0].role_in_company = 'dispatcher'; expect((await recordPayment(request('/', { amount: 10, idempotency_key: 'external-test' }), params)).status).toBe(403); });
  it('prevents redirecting a marketplace invoice away from buyer email', async () => {
    Object.assign(h.tables.invoices[0], { status: 'Draft', invoice_origin: 'marketplace', payment_terms: '14 days' });
    const response = await editDraft(new NextRequest('https://example.test/', { method: 'PATCH', body: JSON.stringify({ client_name: 'Buyer Ltd', client_email: 'unrelated@example.test', invoice_date: '2026-10-18' }) }), params);
    expect(response.status).toBe(409);
  });
});

describe('audit: corrected safeguards', () => {
  // Account/session binding, async settlement, rollback, duplicate events and stale events
  // execute against the real SQL functions in invoicePaymentSqlIntegration.test.ts.
  it('forwards the reserved outstanding amount rather than invoice face value', async () => {
    h.rpc.mockResolvedValueOnce({ data: { id: 'attempt-test', amount_minor: 8000, currency: 'gbp', return_path: '/customer/invoices/test', status: 'reserved' }, error: null });
    await checkout(request('/', { invoiceId: id }));
    expect(h.stripe.mock.calls[0][1].params['line_items[0][price_data][unit_amount]']).toBe(8000);
  });
  it('rejects cancelled invoice even when old approval exists', async () => { h.tables.invoices[0].status = 'Cancelled'; expect((await checkout(request('/', { invoiceId: id }))).status).toBe(409); });
  it('rejects an empty signature object as complete POD', () => { expect(hasCompletePodEvidence({ pod_generated: true, delivery_photos: ['stored/path.png'], client_signature_name: 'Recipient', delivery_signature_data: {} })).toBe(false); });
});

describe('audit: PDF evidence adapter', () => {
  it('preserves supported typed attestation and POD-only evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    h.tables.jobs = [{ id: 'job', pod_photos: ['supplier/job/photos/pod.png'], delivery_photos: [], client_signature_name: 'Recipient', delivery_signature_data: { type: 'recipient_typed_name_attestation', recipient_name: 'Recipient', confirmed_at: '2026-10-18', evidence_path: 'supplier/job/photos/pod.png' } }];
    const download = vi.fn().mockResolvedValue({ data: new Blob(['image']), error: null });
    const context = await loadInvoicePdfContext({ supabase: { from, storage: { from: () => ({ download }) } } as any, companyId: 'supplier', jobId: 'job', origin: 'https://example.test' });
    vi.unstubAllGlobals();
    expect(context.evidenceImages.length).toBeGreaterThan(0);
  });
});

describe('audit: invoice delivery route (PDF renderer and finance identity stubbed)', () => {
  function setupDelivery() {
    Object.assign(h.tables.invoices[0], { status: 'Draft', job_id: null, delivery_state: 'idle', invoice_number: 'INV-TEST', job_ref: 'XDL-TEST', client_name: 'Buyer Ltd', vat_treatment: 'not_registered', net_amount: 120, vat_amount: 0, vat_rate: 0 });
    h.tables.companies = [{ id: 'supplier', name: 'Carrier Ltd' }];
    process.env.RESEND_API_KEY = 'local-test-only';
    const provider = vi.fn().mockImplementation(async (url: string) => url.includes('resend.com') ? new Response(JSON.stringify({ id: 'email_test' }), { status: 200 }) : new Response('', { status: 404 }));
    vi.stubGlobal('fetch', provider);
    return provider;
  }
  it('records sent only after provider acceptance and addresses stored finance email', async () => {
    const provider = setupDelivery();
    const response = await submit(request('/', {}), params);
    vi.unstubAllGlobals();
    expect(response.status).toBe(200);
    expect(h.tables.invoices[0].delivery_message_id).toBe('email_test');
    expect(JSON.parse(provider.mock.calls.find(c => c[0].includes('resend.com'))![1].body).to).toEqual(['finance@example.test']);
  });
  it('keeps Draft and failed when provider rejects', async () => {
    const provider = setupDelivery(); provider.mockImplementation(async () => new Response(JSON.stringify({ message: 'rejected' }), { status: 500 }));
    const response = await submit(request('/', {}), params); vi.unstubAllGlobals();
    expect(response.status).toBe(502); expect(h.tables.invoices[0].status).toBe('Draft'); expect(h.tables.invoices[0].delivery_state).toBe('failed');
  });
  it('replays sent delivery without sending a second email', async () => {
    const provider = setupDelivery(); Object.assign(h.tables.invoices[0], { status: 'Submitted', delivery_state: 'sent', delivery_message_id: 'email_test' });
    const response = await submit(request('/', {}), params); vi.unstubAllGlobals();
    expect(response.status).toBe(200); expect(provider).not.toHaveBeenCalled();
  });
  it('blocks an existing sending claim', async () => {
    setupDelivery(); h.tables.invoices[0].delivery_state = 'sending';
    const response = await submit(request('/', {}), params); vi.unstubAllGlobals(); expect(response.status).toBe(409);
  });
  it('retries with exactly the persisted provider payload', async () => {
    const provider = setupDelivery();
    provider.mockImplementation(async () => new Response(JSON.stringify({ message: 'temporary failure' }), { status: 500 }));
    await submit(request('/', {}), params);
    const originalPayload = JSON.stringify(h.tables.invoice_delivery_outbox[0].payload);
    provider.mockImplementation(async () => new Response(JSON.stringify({ id: 'email_recovered' }), { status: 200 }));
    expect((await submit(request('/', { subject: 'Changed subject ignored on retry' }), params)).status).toBe(200);
    expect(provider.mock.calls.at(-1)![1].body).toBe(originalPayload);
    vi.unstubAllGlobals();
  });
  it('recovers an accepted provider message without resending', async () => {
    const provider = setupDelivery();
    h.tables.invoice_delivery_outbox = [{ invoice_id: id, provider_message_id: 'email_accepted', payload: { frozen: true } }];
    Object.assign(h.tables.invoices[0], { delivery_state: 'sending', delivery_attempted_at: new Date(Date.now()-600_000).toISOString() });
    expect((await submit(request('/', {}), params)).status).toBe(200);
    expect(provider).not.toHaveBeenCalled();
    expect(h.tables.invoices[0].delivery_message_id).toBe('email_accepted');
    vi.unstubAllGlobals();
  });
  it('refuses sending a job-linked invoice when POD is absent', async () => {
    setupDelivery(); h.tables.invoices[0].job_id = 'job'; h.tables.jobs = [{ id: 'job', pod_generated: false }];
    const response = await submit(request('/', {}), params); vi.unstubAllGlobals(); expect(response.status).toBe(409);
  });
});

describe('audit: invoice generation route (identity and feature flags stubbed)', () => {
  function setupGeneration() {
    h.tables.invoices = [];
    h.tables.company_memberships[0].company_id = 'supplier';
    h.tables.jobs = [{ id: 'job', company_id: 'buyer', status: 'delivered', exchange_visibility: 'exchange', pod_generated: true, delivery_photos: ['supplier/job/photos/pod.png'], client_signature_name: 'Recipient', delivery_signature_data: 'data:image/png;base64,TEST' }];
    h.tables.job_commercial_agreements_effective = [{ id: 'agreement', job_id: 'job', supplier_company_id: 'supplier', buyer_company_id: 'buyer', agreed_amount: 100, vat_rate: 20, vat_amount: 20, agreed_gross_amount: 120, currency: 'GBP', payment_terms: '14 days' }];
    h.tables.companies = [{ id: 'buyer', name: 'Buyer Ltd', email: 'general@example.test' }];
    h.tables.company_settings = [{ company_id: 'buyer', finance_email: 'finance@example.test' }];
  }
  const jobParams = { params: Promise.resolve({ jobId: 'job' }) };
  it('blocks generation without complete POD', async () => { setupGeneration(); h.tables.jobs[0].pod_generated = false; expect((await generate(request('/', { idempotency_key: 'generation-test' }), jobParams)).status).toBe(409); });
  it('uses buyer finance email and immutable commercial amount', async () => {
    setupGeneration(); expect((await generate(request('/', { idempotency_key: 'generation-test', amount: 1, client_email: 'override@example.test' }), jobParams)).status).toBe(201);
    expect(h.tables.invoices[0].client_email).toBe('finance@example.test'); expect(h.tables.invoices[0].amount).toBe(120);
  });
  it('falls back to company email when finance email is invalid', async () => { setupGeneration(); h.tables.company_settings[0].finance_email = 'invalid'; await generate(request('/', { idempotency_key: 'generation-test' }), jobParams); expect(h.tables.invoices[0].client_email).toBe('general@example.test'); });
  it('rejects buyer without a valid delivery address', async () => { setupGeneration(); h.tables.company_settings[0].finance_email = ''; h.tables.companies[0].email = ''; expect((await generate(request('/', { idempotency_key: 'generation-test' }), jobParams)).status).toBe(422); });
  it('persists the generation key used by the transactional outbox trigger', async () => {
    setupGeneration(); await generate(request('/', { idempotency_key: 'generation-test' }), jobParams);
    expect(h.tables.invoices[0].invoice_generation_idempotency_key).toBe('generation-test');
  });
});
