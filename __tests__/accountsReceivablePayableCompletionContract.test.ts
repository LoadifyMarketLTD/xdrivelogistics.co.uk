import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyAccountsDirection } from '../lib/finance/accounts';

const read=(relative:string)=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');

describe('Accounts Receivable / Accounts Payable completion',()=>{
  const data=read('app/components/workspace/useCompanyWorkspaceData.ts');
  const api=read('app/api/workspace/finance/control/route.ts');
  const control=read('app/components/workspace/WorkspaceFinanceControl.tsx');
  const register=read('app/components/workspace/InvoiceRegisterPage.tsx');
  const dashboard=read('app/components/workspace/FinanceControlDashboardHome.tsx');
  const driverFinance=read('app/driver/finance/page.tsx');

  it('loads supplier-owned and buyer-owned invoices into non-customer company finance datasets',()=>{
    expect(data).toContain('supplier_company_id.eq.${companyId}');
    expect(data).toContain('buyer_company_id.eq.${companyId}');
  });

  it('derives AR/AP from canonical buyer/supplier ownership and verified payment history',()=>{
    expect(api).toContain("type Direction = 'receivable' | 'payable'");
    expect(api).toContain('supplierCompanyId && companyIds.has(supplierCompanyId)');
    expect(api).toContain('buyerCompanyId && companyIds.has(buyerCompanyId)');
    expect(api).toContain(".from('invoice_payment_history')");
    expect(api).toContain('outstandingAmount: Math.max(0, gross - paidAmount)');
  });

  it('adds aging analysis without fabricating payment state',()=>{
    expect(api).toContain('invoiceAgingBucket');
    expect(api).toContain('receivableAging');
    expect(api).toContain('payableAging');
    expect(control).toContain("['aging', 'Aging']");
    expect(control).toContain('AGING_BUCKET_LABELS');
    expect(api).toContain('No payment state is fabricated.');
  });

  it('exposes explicit Accounts Receivable and Accounts Payable registers and tabs',()=>{
    expect(register).toContain("title: 'Accounts Receivable'");
    expect(register).toContain("title: 'Accounts Payable'");
    expect(register).toContain("classifyAccountsDirection(invoice, workspace.companyId) === 'receivable'");
    expect(register).toContain("classifyAccountsDirection(invoice, workspace.companyId) === 'payable'");
    expect(control).toContain("['receivable', 'Accounts Receivable']");
    expect(control).toContain("['payable', 'Accounts Payable']");
  });

  it('keeps the existing Owner Driver finance receivables/payables split rather than replacing it',()=>{
    expect(driverFinance).toContain("searchParams.get('view') === 'payables' ? 'payables' : 'receivables'");
    expect(driverFinance).toContain("financeView === 'receivables'");
  });

  it('stops the finance dashboard from mixing AP into receivable KPIs',()=>{
    expect(dashboard).toContain("classifyAccountsDirection(invoice, data.companyId) === 'receivable'");
    expect(dashboard).toContain("classifyAccountsDirection(invoice, data.companyId) === 'payable'");
    expect(dashboard).toContain("label: 'AR Awaiting Payment'");
    expect(dashboard).toContain("label: 'AP Awaiting Payment'");
    expect(dashboard).toContain('outstandingValue: dashboardInvoiceValue(unpaid,true)');
    expect(dashboard).toContain('payableOutstandingValue: dashboardInvoiceValue(payableUnpaid,true)');
  });

  it('classifies buyer, supplier, unrelated and legacy invoices without cross-counting',()=>{
    const companyId='company-a';
    const supplierInvoice={company_id:'company-a',supplier_company_id:'company-a',buyer_company_id:'company-b'};
    const buyerInvoice={company_id:'company-b',supplier_company_id:'company-b',buyer_company_id:'company-a'};
    const unrelatedInvoice={company_id:'company-b',supplier_company_id:'company-b',buyer_company_id:'company-c'};
    const legacyReceivable={company_id:'company-a',supplier_company_id:null,buyer_company_id:'company-b'};
    const legacyOwnPurchase={company_id:'company-a',supplier_company_id:null,buyer_company_id:'company-a'};
    expect(classifyAccountsDirection(supplierInvoice,companyId)).toBe('receivable');
    expect(classifyAccountsDirection(buyerInvoice,companyId)).toBe('payable');
    expect(classifyAccountsDirection(unrelatedInvoice,companyId)).toBeNull();
    expect(classifyAccountsDirection(legacyReceivable,companyId)).toBe('receivable');
    expect(classifyAccountsDirection(legacyOwnPurchase,companyId)).toBe('payable');
    expect(classifyAccountsDirection(buyerInvoice,'company-b')).toBe('receivable');
  });
});
