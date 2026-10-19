import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const notifySource = readFileSync(resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'), 'utf8');
const authEmailSource = readFileSync(resolve(process.cwd(), 'supabase/functions/send-email/index.ts'), 'utf8');
const companySource = readFileSync(resolve(process.cwd(), 'app/config/company.ts'), 'utf8');
const marketingSource = readFileSync(resolve(process.cwd(), 'app/(marketing)/_components/MarketingDetailPage.tsx'), 'utf8');

describe('transactional sender routing contract', () => {
  it('defines the complete functional sender family', () => {
    expect(notifySource).toContain("confirmation: 'XDrive Confirmations <confirmation@xdrivelogistics.co.uk>'");
    expect(notifySource).toContain("pod: 'XDrive POD <pod@xdrivelogistics.co.uk>'");
    expect(notifySource).toContain("invoices: 'XDrive Invoices <invoices@xdrivelogistics.co.uk>'");
    expect(notifySource).toContain("payments: 'XDrive Payments <payments@xdrivelogistics.co.uk>'");
    expect(notifySource).toContain("operations: 'XDrive Operations <operations@xdrivelogistics.co.uk>'");
    expect(notifySource).toContain("support: 'XDrive Support <support@xdrivelogistics.co.uk>'");
    expect(notifySource).toContain("alerts: 'XDrive Alerts <alerts@xdrivelogistics.co.uk>'");
  });

  it('uses functional senders for each operational family', () => {
    const jobAssigned = notifySource.slice(notifySource.indexOf('async function handleJobAssigned'), notifySource.indexOf('async function handleCommercialAmendment'));
    const amendments = notifySource.slice(notifySource.indexOf('async function handleCommercialAmendment'), notifySource.indexOf('async function handleBidAccepted'));
    const pod = notifySource.slice(notifySource.indexOf('async function handlePodUploaded'), notifySource.indexOf('async function handleLoadAlert'));
    const loadAlert = notifySource.slice(notifySource.indexOf('async function handleLoadAlert'), notifySource.indexOf('async function handleOperationalSmartAlert'));
    const onboarding = notifySource.slice(notifySource.indexOf('async function handleOnboardingInvite'), notifySource.indexOf('async function handleInvoiceDisputed'));
    const invoice = notifySource.slice(notifySource.indexOf('async function handleInvoiceDisputed'), notifySource.indexOf('async function handleInvoiceCreated'));
    const payment = notifySource.slice(notifySource.indexOf('async function handlePaymentReceived'), notifySource.indexOf('async function handleInvoiceCreated'));

    expect(jobAssigned).toContain("'operations'");
    expect(amendments).toContain("'confirmation'");
    expect(pod).toContain("'pod'");
    expect(loadAlert).toContain("'alerts'");
    expect(notifySource).toContain("event.event_type === 'job_pod_submitted_alert' ? 'pod' : 'operations'");
    expect(onboarding).toContain("'support'");
    expect(invoice).toContain("'invoices'");
    expect(payment).toContain("'payments'");
    expect(notifySource).toContain("case 'invoice_paid':");
    expect(notifySource).toContain("case 'payment_received':");
  });

  it('routes auth and account recovery email through support', () => {
    expect(authEmailSource).toContain("'XDrive Support <support@xdrivelogistics.co.uk>'");
  });

  it('keeps the public contact addresses in one central company config', () => {
    for (const address of [
      'contact@xdrivelogistics.co.uk',
      'operations@xdrivelogistics.co.uk',
      'support@xdrivelogistics.co.uk',
      'confirmation@xdrivelogistics.co.uk',
      'pod@xdrivelogistics.co.uk',
      'invoices@xdrivelogistics.co.uk',
      'payments@xdrivelogistics.co.uk',
    ]) expect(companySource).toContain(address);
  });

  it('keeps the public footer focused on human contact channels', () => {
    expect(marketingSource).toContain('COMPANY_CONFIG.emails.general');
    expect(marketingSource).toContain('COMPANY_CONFIG.emails.operations');
    expect(marketingSource).toContain('COMPANY_CONFIG.emails.support');
    expect(marketingSource).not.toContain('COMPANY_CONFIG.emails.confirmations');
    expect(marketingSource).not.toContain('COMPANY_CONFIG.emails.pod');
    expect(marketingSource).not.toContain('COMPANY_CONFIG.emails.invoices');
    expect(marketingSource).not.toContain('COMPANY_CONFIG.emails.payments');
  });
});
