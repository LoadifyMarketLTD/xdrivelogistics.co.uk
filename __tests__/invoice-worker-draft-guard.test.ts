import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worker = readFileSync(path.join(root, 'app/api/internal/invoice-deliveries/route.ts'), 'utf8');
const send = readFileSync(path.join(root, 'lib/server/invoiceDelivery.ts'), 'utf8');
const create = readFileSync(path.join(root, 'app/api/driver/finance/jobs/[jobId]/generate-invoice/route.ts'), 'utf8');

describe('Invoice Draft cannot be delivered by automatic retry worker', () => {
  it('requires a frozen explicitly prepared email payload and a recorded provider attempt', () => {
    expect(worker).toMatch(/\.not\('payload', 'is', null\)/);
    expect(worker).toMatch(/\.not\('first_provider_attempt_at', 'is', null\)/);
    expect(worker).toMatch(/\.is\('completed_at', null\)/);
  });
  it('retains explicit sender flow and recorded provider attempt', () => {
    expect(send).toMatch(/invoice_delivery_outbox'\)\.update\(\{ payload: emailBody \}/);
    expect(send).toMatch(/first_provider_attempt_at: delivery\.first_provider_attempt_at \?\? attemptedAt/);
  });
  it('invoice creation continues to create draft only, not email directly', () => {
    expect(create).toContain("status: toLegacyInvoiceStatusForDb('Draft')");
    expect(create).not.toContain('api.resend.com');
  });
});
