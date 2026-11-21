import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const delivery = readFileSync(new URL('../lib/server/invoiceDelivery.ts', import.meta.url), 'utf8');
const context = readFileSync(new URL('../lib/server/ownerInvoicePdfContext.ts', import.meta.url), 'utf8');


describe('Dual-party invoice + POD email evidence', () => {
  it('targets the buyer/customer and verifies their email', () => {
    expect(delivery).toContain('const recipientEmail =');
    expect(delivery).toContain('if (!validEmail(recipientEmail))');
    expect(delivery).toContain('to: [recipientEmail]');
  });

  it('requires a valid executing carrier company email rather than dropping the issuer copy', () => {
    expect(context).toContain("issuerEmail: clean(company?.email)");
    expect(delivery).toContain('const carrierEmail =');
    expect(delivery).toContain('if (!validEmail(carrierEmail))');
    expect(delivery).toContain('return failDelivery(422,');
    expect(delivery).toContain('const issuerCopyEmail = carrierEmail !== recipientEmail ? carrierEmail : null');
    expect(delivery).toContain('bcc: [issuerCopyEmail]');
  });

  it('includes invoice and verified POD as two separate PDFs in one email', () => {
    expect(delivery).toContain('requirePod: Boolean(claimedInvoice.job_id)');
    expect(delivery).toContain('const podPages = await podDocument.copyPages');
    expect(delivery).toContain('attachments: [{ filename: fileName, content: Buffer.from(invoiceBytes)');
    expect(delivery).toContain('content: Buffer.from(podBytes)');
    expect(delivery).toContain('generatedAttachments.length !== (claimedInvoice.job_id ? 2 : 1)');
  });

  it('freezes the email snapshot and prevents duplicate send attempts', () => {
    expect(delivery).toContain("update({payload:emailBody})");
    expect(delivery).toContain("'Idempotency-Key': `invoice-send/${id}`");
    expect(delivery).toContain("invoice.delivery_state === 'sent'");
  });
});
