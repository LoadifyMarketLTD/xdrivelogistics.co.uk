import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'app/components/workspace/DriverJobExecutionPage.tsx'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'lib/jobs/podCompletion.ts'), 'utf8');

describe('Driver Job Execution mandatory POD to invoice contract', () => {
  it('requires complete POD evidence before job completion', () => {
    expect(page).toContain("import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion'");
    expect(page).toContain("if (nextStatus === 'completed' && !hasCompletePodEvidence(job))");
    expect(page).toContain('Complete POD before completing this job.');
  });

  it('requires delivery evidence, recipient and signature to complete POD', () => {
    expect(page).toContain('At least one delivery photo is required to complete POD.');
    expect(page).toContain('Recipient name is required to complete POD.');
    expect(page).toContain('Recipient signature is required to complete POD.');
    expect(page).toContain('/api/driver/web/jobs/${encodeURIComponent(job.id)}/pod');
    expect(helper).toContain('evidenceCount > 0');
    expect(helper).toContain('hasStoredSignature(record.delivery_signature_data)');
    expect(helper).toContain('recipientName.length > 0');
  });

  it('unlocks invoice creation only after complete POD', () => {
    expect(page).toContain("if (!hasCompletePodEvidence(job))");
    expect(page).toContain('Complete POD before creating an invoice.');
    expect(page).toContain('/api/driver/finance/jobs/${encodeURIComponent(job.id)}/generate-invoice');
    expect(page).toContain("podComplete && !sheet?.invoices[0]?.id && canGenerateInvoices");
    expect(page).toContain("POD complete · invoice ready for owner/admin");
  });

  it('keeps any separate hard-copy POD requirement explicit', () => {
    expect(page).toContain('requiresHardCopyPod');
    expect(page).toContain('Confirm the hard-copy POD requirement before completing POD.');
    expect(page).toContain('Hard-copy POD requirement completed');
  });
});
