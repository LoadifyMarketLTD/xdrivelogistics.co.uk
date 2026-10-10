import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const panel = readFileSync(join(process.cwd(),'app/components/workspace/CompanyJobSheetPanel.tsx'),'utf8');
const api = readFileSync(join(process.cwd(),'app/api/workspace/jobs/[jobId]/sheet/route.ts'),'utf8');
const diary = readFileSync(join(process.cwd(),'app/components/workspace/OperationsDiaryPage.tsx'),'utf8');
const customerDetail = readFileSync(join(process.cwd(),'app/customer/jobs/[id]/page.tsx'),'utf8');
const customerDiary = readFileSync(join(process.cwd(),'app/customer/diary/page.tsx'),'utf8');
const brokerDiary = readFileSync(join(process.cwd(),'app/broker/diary/page.tsx'),'utf8');

describe('unified booking detail', () => {
  const tabs = ['agreement','route','progress','exception','evidence','pod','invoice','payment','dispute','event-log'] as const;

  it('exposes the canonical booking detail tabs including operational exceptions', () => {
    for (const tab of tabs) expect(panel).toContain(`{ id: '${tab}'`);
    expect(panel).toContain("label: 'Agreement'");
    expect(panel).toContain("label: 'Event Log'");
  });

  it('does not expose legacy Order/Notes/History/Replay/Documents as visible tabs', () => {
    expect(panel).not.toContain("{ id: 'order', label: 'Order' }");
    expect(panel).not.toContain("{ id: 'notes', label: 'Notes' }");
    expect(panel).not.toContain("{ id: 'history', label: 'History' }");
    expect(panel).not.toContain("{ id: 'replay', label: 'Replay' }");
    expect(panel).not.toContain("{ id: 'documents', label: 'Documents' }");
  });

  it('keeps compatibility mapping for old callers without rendering old tabs', () => {
    expect(panel).toContain("if (value === 'order') return 'agreement';");
    expect(panel).toContain("if (value === 'notes') return 'progress';");
    expect(panel).toContain("if (value === 'history' || value === 'replay') return 'event-log';");
    expect(panel).toContain("if (value === 'documents') return 'evidence';");
  });

  it('loads agreement amendments, payment ledger and disputes into the authorised booking endpoint', () => {
    expect(api).toContain("from('job_commercial_agreement_amendments')");
    expect(api).toContain("from('invoice_payment_history')");
    expect(api).toContain("from('job_disputes')");
    expect(api).toContain("from('invoice_disputes')");
    expect(api).toContain('visibleInvoiceIds');
    expect(api).toContain('paymentHistory,');
    expect(api).toContain('amendments,');
    expect(api).toContain('disputes: [...jobDisputes, ...invoiceDisputes]');
  });

  it('exposes contract identity and evidence summary without inventing data', () => {
    expect(api).toContain('agreementId: commercialAwardVisible ? text(agreement.id) : null');
    expect(api).toContain('contractVersion: commercialAwardVisible ? numberValue(agreement.contract_version) : null');
    expect(api).toContain('contractSnapshotHash: commercialAwardVisible ? text(agreement.contract_snapshot_hash) : null');
    expect(api).toContain('collectionPhotoCount: Array.isArray(job.pickup_photos)');
    expect(api).toContain('collectionHandoverRecorded: Boolean(job.collection_handover');
    expect(api).toContain('deliverySignatureRecorded: Boolean(text(job.delivery_signature_data))');
  });

  it('keeps invoice payment data scoped to already authorised invoice IDs', () => {
    expect(api).toContain('const visibleInvoiceIds = invoices.map');
    expect(api).toContain(".in('invoice_id', visibleInvoiceIds)");
    expect(api).toContain('const visibleInvoiceIdSet = new Set(visibleInvoiceIds);');
    expect(api).toContain('visibleInvoiceIdSet.has(invoiceId)');
  });

  it('reuses one booking detail component across customer, broker and carrier surfaces', () => {
    expect(customerDetail).toContain('<CompanyJobSheetPanel jobId={job.id} mode="customer" />');
    expect(customerDiary).toContain('<CompanyJobSheetPanel jobId={job.id} mode="customer" />');
    expect(brokerDiary).toContain('<CompanyJobSheetPanel jobId={job.id} mode="broker" />');
    expect(diary).toContain('<CompanyJobSheetPanel jobId={selectedJobId} mode="carrier"');
  });

  it('updates Operations Diary quick tabs to the canonical booking detail sections', () => {
    expect(diary).toContain("['agreement','route','progress','exception','evidence','pod','invoice','payment','dispute','event-log']");
    expect(diary).toContain("initialTab={detailTabByJob[selectedJobId] ?? 'agreement'}");
    expect(diary).not.toContain("['order','notes','history','documents','pod','invoice','replay']");
  });

  it('renders each canonical section from the unified panel', () => {
    for (const tab of tabs) expect(panel).toContain(`tab === '${tab}'`);
    expect(panel).toContain('Approved extras / adjustments');
    expect(panel).toContain('Contract amendments');
    expect(panel).toContain('Collection photos');
    expect(panel).toContain('No payment history recorded');
    expect(panel).toContain('No disputes recorded');
    expect(panel).toContain('<WorkspaceJobReplay jobId={jobId} />');
  });
});
