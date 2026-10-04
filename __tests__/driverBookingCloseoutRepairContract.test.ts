import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const executionPage = fs.readFileSync(path.join(root, 'app/components/workspace/DriverJobExecutionPage.tsx'), 'utf8');
const driverSheet = fs.readFileSync(path.join(root, 'app/api/driver/jobs/[jobId]/sheet/route.ts'), 'utf8');
const replayRoute = fs.readFileSync(path.join(root, 'app/api/workspace/jobs/[jobId]/replay/route.ts'), 'utf8');
const replayPage = fs.readFileSync(path.join(root, 'app/components/workspace/WorkspaceJobReplay.tsx'), 'utf8');
const invoiceDetailPage = fs.readFileSync(path.join(root, 'app/driver/finance/invoices/[id]/page.tsx'), 'utf8');

describe('driver booking closeout repair contract', () => {
  it('captures the full delivery confirmation data supported by the POD API', () => {
    expect(executionPage).toContain('deliveryStatus: podDeliveryStatus');
    expect(executionPage).toContain('leftAt: podLeftAt.trim() || undefined');
    expect(executionPage).toContain('itemCount: podItemCount.trim() ? Number(podItemCount) : undefined');
    expect(executionPage).toContain('deliveredOn: podDeliveredOn || undefined');
    expect(executionPage).toContain('View POD');
    expect(executionPage).toContain('Proof of Delivery');
  });

  it('opens a newly generated invoice in review/edit instead of a broken summary-only view', () => {
    expect(executionPage).toContain('router.push(`/driver/finance/invoices/${payload.invoice.id}/edit`)');
  });

  it('projects an existing invoice to finance-authorised carrier members', () => {
    expect(driverSheet).toContain("const canViewFinance = ['owner', 'admin', 'finance'].includes(financeRole)");
    expect(driverSheet).toContain(".from('invoices')");
    expect(driverSheet).toContain(".eq('job_id', jobId)");
    expect(driverSheet).toContain(".eq('company_id', driver.companyId)");
  });

  it('does not treat a no-additional-hard-copy message as a required hard-copy POD', () => {
    expect(executionPage).toContain("normalized.includes('no additional')");
    expect(executionPage).toContain('requiresHardCopyPod(sheet?.hardCopyPod ?? job.hard_copy_pod)');
  });

  it('renders invoice detail as a full-width readable page rather than a summary rail with an empty main area', () => {
    expect(invoiceDetailPage).toContain('const summary = (');
    expect(invoiceDetailPage).toContain('className="driver-invoice-detail-board"');
    expect(invoiceDetailPage).toContain('{summary}');
    expect(invoiceDetailPage).not.toContain('className="driver-board-layout driver-invoice-detail-board"');
  });

  it('keeps route planning separate from recorded journey replay', () => {
    expect(executionPage).not.toContain('>Route / Track</a>');
    expect(executionPage).toContain('>Route</a>');
    expect(executionPage).toContain('>Journey Replay</ActionButton>');
    expect(replayRoute).toContain('trackedMiles: points.length ? Math.round(trackedMiles * 10) / 10 : null');
    expect(replayRoute).toContain('startedAt: points[0]?.recordedAt ?? null');
    expect(replayRoute).toContain('endedAt: points.at(-1)?.recordedAt ?? null');
    expect(replayPage).toContain("replay.summary.trackedMiles == null ? 'Not recorded'");
  });
});
