import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Driver Diary member and invoice parity', () => {
  const diary = read('app/driver/history/page.tsx');
  const sheet = read('app/api/driver/jobs/[jobId]/sheet/route.ts');

  it('recovers business-facing member names when the client relation is hidden by RLS', () => {
    expect(diary).toContain('/api/member-profile/${encodeURIComponent(companyId)}');
    expect(diary).toContain('memberNameByCompany');
    expect(diary).toContain('Member not supplied');
  });

  it('reuses canonical finance visibility before exposing invoice rows in Diary', () => {
    expect(sheet).toContain(".from('company_memberships')");
    expect(sheet).toContain("membershipRole === 'owner' || membershipRole === 'admin'");
    expect(sheet).toContain(".from('invoices')");
    expect(sheet).toContain(".eq('company_id', driver.companyId)");
    expect(sheet).toContain(".eq('job_id', jobId)");
    expect(sheet).toContain("invoiceQuery = invoiceQuery.eq('created_by', driver.userId)");
    expect(sheet).not.toContain('const invoicePromise = Promise.resolve({ data: [], error: null });');
  });
});
