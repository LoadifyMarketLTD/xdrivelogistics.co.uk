import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/notify-operational-event/index.ts'),
  'utf8',
);

describe('external notification human-reference contract', () => {
  it('blocks any external email that still contains an internal UUID', () => {
    expect(source).toContain("External email blocked because it contains an internal UUID.");
    expect(source).toContain('uuidPattern.test(subject) || uuidPattern.test(html)');
  });

  it('resolves job references from human-facing booking/customer/load references', () => {
    expect(source).toContain('payload.booking_reference');
    expect(source).toContain('payload.customer_reference');
    expect(source).toContain('payload.load_id');
    expect(source).toContain('row?.booking_reference');
    expect(source).toContain('row?.customer_reference');
    expect(source).toContain('row?.load_id');
    expect(source).toContain("return 'your booking';");
  });

  it('renders POD emails with operational context and a clear CTA instead of the UUID', () => {
    const handler = source.slice(
      source.indexOf('async function handlePodUploaded'),
      source.indexOf('async function handleLoadAlert'),
    );
    expect(handler).toContain('loadPodEmailBundle(event)');
    expect(handler).toContain('POD - ');
    expect(handler).toContain('Booking ref');
    expect(handler).toContain('Received by');
    expect(handler).toContain('Left at');
    expect(handler).toContain('Delivery status');
    expect(handler).toContain('bundle.attachments');
    expect(handler).toContain('View POD in XDrive');
    expect(handler).not.toContain('event.payload.job_id ?? event.entity_id');
  });

  it('uses profile/company identity instead of an email username for greetings', () => {
    expect(source).toContain(".from('profiles')");
    expect(source).toContain(".select('full_name, company_id')");
    expect(source).toContain(".from('companies')");
    expect(source).toContain(".select('name')");
    expect(source).toContain("name: 'there'");
  });

  it('keeps internal job ids out of email hrefs', () => {
    expect(source).not.toContain('buildAppUrl(`/driver/jobs/${encodeURIComponent(jobIdRaw)}`)');
    expect(source).not.toContain("buildAppUrl('/customer/jobs/' + encodeURIComponent(jobId))");
  });

  it('resolves disputed invoices to invoice_number rather than invoice UUID', () => {
    expect(source).toContain('getPublicInvoiceReference(event)');
    expect(source).toContain(".select('invoice_number')");
    expect(source).toContain('Invoice <strong>${invoiceReference}</strong> has been disputed.');
  });
});
