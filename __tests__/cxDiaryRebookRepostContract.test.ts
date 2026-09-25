import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const form = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
const prefillApi = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/jobs/[id]/clone-prefill/route.ts'), 'utf8');
const createApi = fs.readFileSync(path.join(process.cwd(), 'app/api/jobs/create/route.ts'), 'utf8');

describe('CX Diary Re-book / Re-post parity', () => {
  it('offers new-booking actions only from eligible company-owned history', () => {
    expect(diary).toContain('sourceAction=rebook');
    expect(diary).toContain('sourceAction=repost');
    expect(diary).toContain("['completed', 'cancelled', 'expired'].includes(stage)");
    expect(diary).toContain("['cancelled', 'expired'].includes(stage)");
    expect(diary).toContain('canManageCompanyBookings && job.company_id === companyId');
  });

  it('authorises source prefill through the canonical company-admin boundary', () => {
    expect(prefillApi).toContain('requireCompanyAdmin(request, companyId)');
    expect(prefillApi).toContain("String(job.company_id) !== admin.companyId");
    expect(prefillApi).toContain("REBOOK_STATUSES = new Set(['delivered', 'completed', 'cancelled', 'expired'])");
    expect(prefillApi).toContain("REPOST_STATUSES = new Set(['cancelled', 'expired'])");
  });

  it('copies safe operational fields while resetting historical/commercial state', () => {
    for (const field of ['pickupAddress', 'deliveryAddress', 'vehicle', 'cargo', 'additionalStops']) expect(prefillApi).toContain(field);
    for (const reset of ["customerReference: ''", "purchaseOrder: ''", "bookingReference: ''", "customerPrice: ''", "targetCarrierCost: ''", 'isFixedPrice: false']) expect(prefillApi).toContain(reset);
    expect(prefillApi).not.toContain('assigned_driver_id');
    expect(prefillApi).not.toContain('pod_generated');
    expect(prefillApi).not.toContain("from('invoices')");
    expect(prefillApi).not.toContain("from('job_bids')");
  });

  it('creates a fresh job through the existing guarded Post Load flow', () => {
    expect(form).toContain('/clone-prefill?companyId=');
    expect(form).toContain("idempotencyKeyRef.current = null");
    expect(form).toContain("pickupDate: '', pickupTime: '', deliveryDate: '', deliveryTime: ''");
    expect(createApi).toContain('getStripeCommercialReadiness');
    expect(createApi).toContain('creation_idempotency_key');
  });
});
