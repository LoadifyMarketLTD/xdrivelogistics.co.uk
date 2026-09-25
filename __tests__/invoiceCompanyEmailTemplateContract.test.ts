import fs from 'node:fs';
import path from 'node:path';

const submit = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/finance/invoices/[id]/submit/route.ts'), 'utf8');
const defaultsApi = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/finance/invoices/[id]/email-defaults/route.ts'), 'utf8');
const panel = fs.readFileSync(path.join(process.cwd(), 'app/driver/finance/invoices/[id]/DriverInvoiceEmailPanel.tsx'), 'utf8');
const template = fs.readFileSync(path.join(process.cwd(), 'lib/invoiceEmailTemplate.ts'), 'utf8');

describe('company-level invoice email defaults', () => {
  it('uses company template before the canonical XDrive fallback', () => {
    expect(submit).toContain("select('invoice_email_subject_template,invoice_email_message_template')");
    expect(submit).toContain('requestedSubject || companySubjectTemplate || DEFAULT_INVOICE_EMAIL_SUBJECT');
    expect(submit).toContain('requestedMessage || companyMessageTemplate || DEFAULT_INVOICE_EMAIL_MESSAGE');
  });

  it('loads the saved company default for authorised invoice senders', () => {
    expect(defaultsApi).toContain("senderRoles = new Set(['owner', 'admin', 'dispatcher', 'finance'])");
    expect(panel).toContain('/email-defaults`');
    expect(panel).toContain('setCompanySubjectDefault(payload.subject)');
    expect(panel).toContain('setCompanyMessageDefault(payload.message)');
    expect(panel).toContain('templateReady &&');
  });

  it('retains the XDrive statutory late-payment wording and no weekly penalty', () => {
    expect(template).toContain('statutory interest and recovery-cost compensation where applicable');
    expect(template).not.toContain('£25.00 per week');
    expect(template).not.toContain('more than 7 days overdue');
  });
});
