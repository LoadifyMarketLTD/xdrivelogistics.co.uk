import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.join(process.cwd(), 'app/customer/disputes/page.tsx'), 'utf8');
const api = fs.readFileSync(path.join(process.cwd(), 'app/api/customer/disputes/route.ts'), 'utf8');
const roles = fs.readFileSync(path.join(process.cwd(), 'lib/workspaceRole.ts'), 'utf8');

describe('CX-close customer dispute workflow', () => {
  it('exposes a customer dispute register and creation flow', () => {
    expect(page).toContain('Feedback & Disputes');
    expect(page).toContain('Raise Dispute');
    expect(page).toContain('Raise dispute');
    expect(page).toContain("fetch('/api/customer/disputes'");
    expect(page).toContain("['Job', 'Issue', 'Opened', 'Status', 'Resolution']");
  });

  it('validates the job/company relationship on the server before insert', () => {
    expect(api).toContain(".from('company_memberships')");
    expect(api).toContain(".eq('status', 'active')");
    expect(api).toContain(".from('jobs')");
    expect(api).toContain(".eq('company_id', context.companyId)");
    expect(api).toContain("terminal.has(jobState)");
    expect(api).toContain(".from('job_disputes')");
    expect(api).toContain("raised_by_company_id: context.companyId");
  });

  it('prevents duplicate active disputes and records the action in job notes', () => {
    expect(api).toContain(".in('status', ['open', 'investigating'])");
    expect(api).toContain('An active dispute already exists for this job.');
    expect(api).toContain("[CUSTOMER_DISPUTE_RAISED]");
  });

  it('makes the workflow discoverable without changing Super Admin', () => {
    expect(roles).toContain("href: '/customer/disputes'");
    expect(page).not.toContain('/super-admin');
    expect(api).not.toContain('/super-admin');
  });
});
