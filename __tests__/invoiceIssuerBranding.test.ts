import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('invoice issuer branding contract', () => {
  it('never uses the platform logo as the invoice issuer fallback', () => {
    const context = read('lib/server/invoicePdfContext.ts');
    const pdf = read('lib/server/invoicePdf.ts');
    expect(context).not.toContain('xdrive-logo-primary.png');
    expect(pdf).not.toContain("page.drawText('XDrive'");
    expect(context).toContain("select('email, phone, website, logo_url')");
    expect(context).toContain('loadCompanyLogo(supabase, company?.logo_url)');
    expect(context).toContain("host === 'xdrivelogistics.co.uk'");
    expect(context).toContain("host === 'app.xdrivelogistics.co.uk'");
    expect(pdf).not.toContain('XDrive ID');
  });

  it('uses issuer website and issuer email rather than platform branding', () => {
    const preview = read('app/api/driver/finance/invoices/[id]/preview/route.ts');
    const delivery = read('lib/server/invoiceDelivery.ts');
    expect(preview).toContain('issuerWebsite: pdfContext.issuerWebsite');
    expect(delivery).toContain('issuerWebsite: pdfContext.issuerWebsite');
    expect(delivery).toContain('reply_to: pdfContext.issuerEmail || undefined');
    expect(delivery).not.toContain("issuerWebsite: 'www.xdrivelogistics.co.uk'");
  });

  it('does not email an invoice-created notification that can be mistaken for the invoice', () => {
    const notify = read('supabase/functions/notify-operational-event/index.ts');
    const handler = notify.slice(
      notify.indexOf('async function handleInvoiceCreated'),
      notify.indexOf('async function processEvent'),
    );
    expect(handler).toContain('return true;');
    expect(handler).not.toContain('sendEmail(');
    expect(handler).not.toContain('emailCompanyOperators(');
  });
});
