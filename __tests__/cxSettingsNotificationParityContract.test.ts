import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'app/admin/settings/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/admin/settings/settings-exchange.css'), 'utf8');

describe('CX-close company settings structure', () => {
  it('exposes notifications as a first-class settings section', () => {
    expect(page).toContain("id: 'notifications'");
    expect(page).toContain('Notification Inbox');
    expect(page).toContain('Bid / quote received');
  });

  it('preserves the existing company settings persistence contract', () => {
    expect(page).toContain('notify_email_new_job: notifForm.emailNewJob');
    expect(page).toContain('notify_email_status_change: notifForm.emailStatusChange');
    expect(page).toContain('notify_email_invoice_paid: notifForm.emailInvoicePaid');
    expect(page).toContain('notify_email_bid_received: notifForm.emailBidReceived');
    expect(page).toContain(".from('company_settings').upsert(settingsPayload)");
  });

  it('does not fabricate granular load-alert preferences unsupported by the schema', () => {
    expect(page).toContain('Granular CX-style location, vehicle-size, return-journey and live-position alert rules');
    expect(page).toContain('separate parity-ledger item');
  });

  it('uses measured workspace settings geometry', () => {
    expect(css).toContain('grid-template-columns: 190px minmax(0, 1fr)');
    expect(css).toContain('var(--ws-control-h, 32px)');
    expect(css).toContain('var(--ws-radius, 4px)');
  });

  it('does not couple settings to Super Admin', () => {
    expect(page).not.toContain('/super-admin');
    expect(css).not.toContain('/super-admin');
  });
});
