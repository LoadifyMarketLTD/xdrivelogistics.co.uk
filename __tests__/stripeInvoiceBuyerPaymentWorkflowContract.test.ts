import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const approval = read('app/api/admin/invoices/[id]/approve/route.ts');
const checkout = read('app/api/payments/jobs/checkout/route.ts');
const paymentHistory = read('app/api/admin/invoices/[id]/payment-history/route.ts');
const financeDetailApi = read('app/api/finance/invoices/[id]/route.ts');
const detailPage = read('app/components/workspace/InvoiceDetailPage.tsx');
const registerPage = read('app/components/workspace/InvoiceRegisterPage.tsx');
const membershipRole = read('lib/membershipRole.ts');
const financePermissions = read('lib/financePermissions.ts');

describe('buyer invoice approval and Stripe payment workflow', () => {
  it('requires buyer payment authority before approving an issued invoice', () => {
    expect(approval).toContain("invoice.buyer_company_id");
    expect(approval).toContain("membershipHasCapability(role, 'payments.manage')");
    expect(approval).toContain("status: 'Approved'");
    expect(approval).toContain('approved_at: approvedAt');
    expect(approval).toContain('approved_by: authData.user.id');
    expect(approval).toContain('Only an issued invoice can be approved for payment.');
  });

  it('refuses Stripe Checkout until buyer approval exists', () => {
    expect(checkout).toContain('approved_at');
    expect(checkout).toContain('Invoice must be approved by the buyer before Stripe payment can start.');
    expect(checkout).toContain("membershipHasCapability(buyerRole, 'payments.manage')");
    expect(checkout).toContain('connectedAccount: supplierIsPlatform ? null : stripeAccountId');
    expect(checkout).toContain('platformCustodiesFunds: false');
    expect(checkout).toContain('xdriveApplicationFee: 0');
    expect(checkout).toContain('safePaymentReturnPath');
    expect(checkout).toContain("'/admin/finance/carrier-invoices/'");
  });

  it('authorises external payment recording against the buyer company', () => {
    expect(paymentHistory).toContain('buyer_company_id');
    expect(paymentHistory).toContain('const payerCompanyId');
    expect(paymentHistory).toContain(".eq('company_id', payerCompanyId)");
  });

  it('exposes buyer payment capability from the authorised invoice detail API', () => {
    expect(financeDetailApi).toContain("membershipHasCapability(buyerRole, 'payments.manage')");
    expect(financeDetailApi).toContain('canManageBuyerPayments');
    expect(financeDetailApi).toContain('isBuyer: Boolean');
    expect(financeDetailApi).toContain('approved_at: invoice.approved_at');
  });

  it('renders approval, Stripe payment, and external-payment controls only in buyer detail context', () => {
    expect(detailPage).toContain("viewerContext?.isBuyer && viewerContext.canManageBuyerPayments");
    expect(detailPage).toContain('Approve Invoice');
    expect(detailPage).toContain('Pay with Stripe');
    expect(detailPage).toContain("fetch('/api/payments/jobs/checkout'");
    expect(detailPage).toContain('Record External Payment');
    expect(detailPage).toContain('/payment-history');
    expect(detailPage).toContain('XDrive does not custody transport funds');
  });

  it('routes carrier payables to the buyer-safe invoice detail surface', () => {
    expect(registerPage).toContain("detailBase: '/admin/finance/carrier-invoices'");
  });

  it('keeps payment authority away from Dispatcher while allowing Company Admin', () => {
    const adminBlock = membershipRole.split('admin: [')[1]?.split('],')[0] ?? '';
    const dispatcherBlock = membershipRole.split('dispatcher: [')[1]?.split('],')[0] ?? '';
    expect(adminBlock).toContain("'payments.manage'");
    expect(dispatcherBlock).not.toContain("'payments.manage'");
    expect(financePermissions).not.toContain("'dispatcher'");
  });
});
