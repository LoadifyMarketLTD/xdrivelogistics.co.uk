import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const intelligenceApi = fs.readFileSync(path.join(process.cwd(), 'app/api/workspace/operations-intelligence/route.ts'), 'utf8');
const feedbackApi = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/jobs/[id]/feedback/route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260925015500_company_feedback_identity.sql'), 'utf8');

describe('CX Diary P1 feedback and search parity', () => {
  it('supports Booked By and combined Member / Driver search from real identities', () => {
    expect(diary).toContain('BOOKED BY');
    expect(diary).toContain('Member, driver or ID');
    expect(diary).toContain('detail?.createdByName');
    expect(diary).toContain('detail?.awardedCompanyName');
    expect(intelligenceApi).toContain("from('profiles').select('id,full_name,email')");
    expect(intelligenceApi).toContain('createdByName: text(creatorProfile?.full_name)');
  });

  it('stores one company-level review per booking and reviewer company', () => {
    expect(migration).toContain('reviewer_company_id');
    expect(migration).toContain('reviews_job_reviewer_company_unique');
    expect(feedbackApi).toContain(".eq('reviewer_company_id', companyId)");
    expect(feedbackApi).toContain("operatorRoles = new Set(['owner', 'admin', 'dispatcher'])");
    expect(feedbackApi).toContain("targetCompanyId = job.awarded_carrier_company_id ?? job.assigned_company_id");
  });

  it('wires Leave Feedback / Edit Feedback to the authorised API', () => {
    expect(diary).toContain('Leave Feedback');
    expect(diary).toContain('Edit Feedback');
    expect(diary).toContain('/feedback`');
    expect(diary).toContain(".eq('reviewer_company_id', companyId)");
  });
});
