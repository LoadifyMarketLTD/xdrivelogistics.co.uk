import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const generate = read('app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts');
const sender = read('app/api/driver/finance/invoices/[id]/submit/route.ts');
const deliveryHelper = read('lib/client/invoiceDelivery.ts');
const execution = read('app/components/workspace/DriverJobExecutionPage.tsx');
const diary = read('app/driver/history/page.tsx');
const finance = read('app/driver/finance/page.tsx');
const pdfContext = read('lib/server/invoicePdfContext.ts');

describe('automatic POD + invoice delivery after invoice creation', () => {
  it('targets the buyer finance email first and falls back to the company email', () => {
    expect(generate).toContain(".from('company_settings')");
    expect(generate).toContain(".select('finance_email')");
    expect(generate).toContain('const financeEmail');
    expect(generate).toContain('const companyEmail');
    expect(generate).toContain('buyerEmail = validEmail(financeEmail) ? financeEmail : companyEmail');
  });

  it('uses the canonical invoice submit endpoint for automatic delivery', () => {
    expect(deliveryHelper).toContain('/api/driver/finance/invoices/');
    expect(deliveryHelper).toContain('/submit');
    expect(deliveryHelper).toContain("method: 'POST'");
    expect(deliveryHelper).toContain("throw new Error(payload?.error ?? 'Invoice was created but could not be sent.')");
  });

  it('auto-sends after invoice creation from execution, diary and finance surfaces', () => {
    for (const source of [execution, diary, finance]) {
      expect(source).toContain('sendGeneratedInvoice(');
    }
    expect(execution).toContain('Invoice created and sent to the buyer finance contact with POD and signature evidence.');
    expect(execution).not.toContain('Draft invoice created. Review it before sending.');
  });

  it('keeps POD and signature evidence inside the generated invoice PDF context', () => {
    expect(sender).toContain('evidenceImages: pdfContext.evidenceImages');
    expect(pdfContext).toContain('evidenceImages');
    expect(pdfContext.toLowerCase()).toContain('signature');
    expect(pdfContext.toLowerCase()).toContain('recipient');
  });

  it('marks delivery sent only after the email provider accepts the invoice', () => {
    expect(sender).toContain("delivery_state: 'sent'");
    expect(sender).toContain("delivery_provider: 'resend'");
    expect(sender).toContain('delivery_message_id: emailPayload.id');
    expect(sender).toContain("return failDelivery(502");
  });
});
