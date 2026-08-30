import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'app/broker/disputes/page.tsx'), 'utf8');
const api = fs.readFileSync(path.join(process.cwd(), 'app/api/broker/disputes/[id]/route.ts'), 'utf8');

describe('CX-close broker disputes workflow', () => {
  it('keeps a dense broker dispute register with operational states and resolution actions', () => {
    for (const label of ['Search Disputes', 'Open', 'Investigating', 'Resolved', 'Resolve', 'Escalate']) {
      expect(page).toContain(label);
    }
    expect(page).toContain("['Job', 'Raised by', 'Issue', 'Opened', 'Status', 'Resolution note', 'Actions']");
  });

  it('keeps dispute mutations behind the authenticated broker API', () => {
    expect(page).toContain("fetch(`/api/broker/disputes/${disputeId}`");
    expect(api).toContain("action: z.enum(['resolve', 'escalate'])");
    expect(api).toContain(".from('company_memberships')");
    expect(api).toContain(".eq('status', 'active')");
    expect(api).toContain("const hasAccess =");
    expect(api).toContain("job?.company_id === companyId");
  });

  it('records dispute handling in job notes and does not couple to Super Admin', () => {
    expect(api).toContain("admin.from('job_notes').insert");
    expect(page).not.toContain('/super-admin');
    expect(api).not.toContain('/super-admin');
  });
});
