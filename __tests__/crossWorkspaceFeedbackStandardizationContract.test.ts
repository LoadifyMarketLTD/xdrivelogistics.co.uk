import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read=(relative:string)=>fs.readFileSync(path.join(process.cwd(),relative),'utf8');

describe('cross-workspace feedback standardization', () => {
  const api=read('app/api/admin/jobs/[id]/feedback/route.ts');
  const customer=read('app/customer/diary/page.tsx');
  const broker=read('app/broker/diary/page.tsx');
  const operations=read('app/components/workspace/OperationsDiaryPage.tsx');
  const ownerDriver=read('app/driver/history/page.tsx');
  const snapshot=read('app/api/driver/diary/company-snapshot/route.ts');
  const diary=read('lib/diary/canonicalDiary.ts');
  const dialog=read('app/components/workspace/CompanyFeedbackDialog.tsx');

  it('keeps one company review per booking/reviewer while resolving the counterparty server-side', () => {
    expect(api).toContain('resolveFeedbackCounterpartyCompanyId(job, companyId)');
    expect(api).toContain("operatorRoles = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager'])");
    expect(api).toContain(".eq('reviewer_company_id', companyId)");
    expect(api).toContain("kind: 'company_feedback'");
    expect(api).toContain('reviewed_company_id: targetCompanyId');
  });

  it('scopes Diary feedback to the current reviewer company instead of any review on the booking', () => {
    expect(customer).toContain(".eq('reviewer_company_id', companyId)");
    expect(broker).toContain(".eq('reviewer_company_id', companyId)");
    expect(operations).toContain(".eq('reviewer_company_id', companyId)");
    expect(snapshot).toContain(".eq('reviewer_company_id', driver.companyId)");
  });

  it('provides Customer, Broker, Carrier/Fleet and Owner Driver with the same feedback eligibility contract', () => {
    expect(customer).toContain('canLeaveCompanyFeedback(job, companyId)');
    expect(broker).toContain('isCompanyFeedbackEligible(job, companyId)');
    expect(operations).toContain('isCompanyFeedbackEligible(job, companyId)');
    expect(ownerDriver).toContain('canLeaveCompanyFeedback(job, feedbackReviewerCompanyId)');
    expect(ownerDriver).toContain('<CompanyFeedbackDialog');
    expect(customer).toContain('<CompanyFeedbackDialog');
  });

  it('keeps employed Driver out of company feedback mutation while allowing company scope for Owner Driver', () => {
    expect(ownerDriver).toContain("const feedbackReviewerCompanyId = canViewCompanyDiary && diaryScope === 'company' ? companyId : null");
    expect(ownerDriver).toContain('feedbackReviewerCompanyId && canLeaveCompanyFeedback');
  });

  it('prevents internal completed bookings from appearing as awaiting feedback', () => {
    expect(diary).toContain('feedbackEligible?: boolean');
    expect(diary).toContain("stage === 'completed' && feedbackEligible && !hasFeedback");
  });

  it('uses one reusable company feedback dialog for rating and comment mutation', () => {
    expect(dialog).toContain('One company review is stored per booking and reviewer company.');
    expect(dialog).toContain("method: 'POST'");
    expect(dialog).toContain('rating, comment');
  });
});
