import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const worker = read('supabase/functions/notify-operational-event/index.ts');
const driverPayments = read('app/api/driver/finance/invoices/[id]/payment-history/route.ts');
const adminPayments = read('app/api/admin/invoices/[id]/payment-history/route.ts');
const stripe = read('app/api/payments/webhooks/connect/route.ts');

describe('payment remittance notification contract', () => {
  it('enqueues payment_received from every canonical payment write path', () => {
    for (const source of [driverPayments, adminPayments, stripe]) {
      expect(source).toContain("event_type: 'payment_received'");
      expect(source).toContain("entity_type: 'invoice'");
      expect(source).toContain("external_reference");
    }
  });

  it('sends a remittance PDF from the payments identity', () => {
    expect(worker).toContain('buildRemittanceAdviceAttachment');
    expect(worker).toContain("You've been paid - Remittance advice - Invoice");
    expect(worker).toContain("'payments'");
    expect(worker).toContain('[attachment]');
    expect(worker).toContain('<strong>Customers:</strong> 1');
  });
});
