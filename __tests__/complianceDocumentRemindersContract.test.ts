import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('missing and expiring compliance document reminders', () => {
  const migration = read('supabase/migrations/20261009211500_compliance_document_reminders.sql');
  const labels = read('supabase/migrations/20261009212500_document_reminder_inbox_labels.sql');
  const endpoint = read('app/api/admin/fleet/document-reminders/route.ts');
  const compliance = read('app/admin/fleet/compliance/page.tsx');
  const worker = read('supabase/functions/notify-operational-event/index.ts');

  it('reuses canonical onboarding requirements for Driver missing-document detection', () => {
    expect(migration).toContain('get_missing_onboarding_documents(app.id)');
    expect(migration).toContain("missing.document_family = 'identity'");
    expect(migration).toContain("'compliance_documents_missing'");
    expect(migration).toContain("'driver_missing'");
  });

  it('covers current MOT and insurance plus expiring Fleet vehicle documents', () => {
    expect(migration).toContain("then 'mot'");
    expect(migration).toContain("then 'insurance'");
    expect(migration).toContain("'vehicle_expiring'");
    expect(migration).toContain("'compliance_document_expiring'");
  });

  it('is duplicate-protected and scheduled daily rather than spamming recipients', () => {
    expect(migration).toContain("existing.created_at >= now() - interval '7 days'");
    expect(migration).toContain("'xdrive-daily-compliance-document-reminders'");
    expect(migration).toContain("'15 7 * * *'");
  });

  it('keeps manual Fleet reminder execution behind existing company Fleet authority', () => {
    expect(endpoint).toContain("requireCompanyCapability(request, companyId, 'documents.company.manage')");
    expect(endpoint).toContain("rpc('enqueue_compliance_document_reminders'");
    expect(compliance).toContain('Send due reminders');
    expect(compliance).toContain('/api/admin/fleet/document-reminders');
  });

  it('delivers reminders through the existing durable notification queue and inbox bridge labels', () => {
    expect(worker).toContain('handleComplianceDocumentReminder');
    expect(worker).toContain("case 'compliance_documents_missing':");
    expect(worker).toContain("case 'compliance_document_expiring':");
    expect(labels).toContain("when 'compliance_documents_missing' then 'Compliance documents required'");
    expect(labels).toContain("when 'compliance_document_expiring' then 'Compliance document expiry'");
  });
});
