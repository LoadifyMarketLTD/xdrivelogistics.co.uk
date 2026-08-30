import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'app/admin/invoices/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/admin/invoices/invoice-register-exchange.css'), 'utf8');

describe('CX-close finance invoice register', () => {
  it('uses role-specific accounting signals rather than summary cards', () => {
    expect(page).toContain('OperationalSignalStrip');
    for (const label of ['All invoices', 'Draft', 'Awaiting payment', 'Overdue', 'Disputed', 'Paid', 'Outstanding']) {
      expect(page).toContain(`label: '${label}'`);
    }
  });

  it('keeps the verified invoice lifecycle and payment-detail route', () => {
    expect(page).toContain("['All', 'Draft', 'Sent', 'Overdue', 'Paid', 'Disputed', 'Cancelled']");
    expect(page).toContain('Record Payment');
    expect(page).toContain('toCanonicalPaymentStatus');
    expect(page).toContain("router.push(`/admin/invoices/${invoice.id}`)");
  });

  it('does not fabricate unverified SmartPay/CX accounting actions', () => {
    expect(page).toContain('Ready to Invoice / external invoice parity');
    expect(page).toContain('external invoice upload, batch invoicing and statements/export');
    expect(page).toContain('remain separate parity-ledger items rather than being fabricated');
  });

  it('uses the measured workspace geometry', () => {
    expect(css).toContain('var(--ws-tab-h, 28px)');
    expect(css).toContain('var(--ws-control-h, 32px)');
    expect(css).toContain('var(--ws-radius, 4px)');
  });

  it('does not couple finance to Super Admin', () => {
    expect(page).not.toContain('/super-admin');
    expect(css).not.toContain('/super-admin');
  });
});
