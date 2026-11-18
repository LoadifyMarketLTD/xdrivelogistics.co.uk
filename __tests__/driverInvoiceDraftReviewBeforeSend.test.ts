import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/DriverJobExecutionPage.tsx'), 'utf8');
const createInvoice = page.slice(page.indexOf('const createInvoice = async () => {'), page.indexOf('const moveStatus = async (nextStatus: string) => {'));

describe('Invoice draft review before delivery', () => {
  it('does not submit an invoice automatically when generating a draft', () => {
    expect(createInvoice).toContain('/generate-invoice');
    expect(createInvoice).not.toContain('sendGeneratedInvoice(');
    expect(createInvoice).not.toContain('/submit');
  });

  it('opens the draft editor for web and mobile after creation', () => {
    expect(createInvoice).toContain('router.push(`/driver/finance/invoices/${payload.invoice.id}/edit`)');
    expect(createInvoice).toContain('Review and approve it before sending');
  });
});
