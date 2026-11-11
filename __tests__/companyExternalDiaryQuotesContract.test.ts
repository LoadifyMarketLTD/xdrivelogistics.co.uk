import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isExternallyFulfilledPostedJob } from '../lib/diary/companyOutsourcedJobs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Company Quotes and outsourced Diary use verified, separate ownership scopes', () => {
  const posted = {company_id:'our-company',awarded_carrier_company_id:'external-carrier',assigned_company_id:'external-carrier'};
  it('shows externally awarded posted jobs to the posting company only', () => {
    expect(isExternallyFulfilledPostedJob(posted,'our-company')).toBe(true);
    expect(isExternallyFulfilledPostedJob(posted,'another-company')).toBe(false);
    expect(isExternallyFulfilledPostedJob({...posted,company_id:'another-company'},'our-company')).toBe(false);
    expect(isExternallyFulfilledPostedJob({...posted,awarded_carrier_company_id:'our-company'},'our-company')).toBe(false);
    expect(isExternallyFulfilledPostedJob({...posted,awarded_carrier_company_id:null,assigned_company_id:'external-carrier'},'our-company')).toBe(true);
    expect(isExternallyFulfilledPostedJob({...posted,awarded_carrier_company_id:null,assigned_company_id:null},'our-company')).toBe(false);
    expect(isExternallyFulfilledPostedJob(posted,null)).toBe(false);
  });
  it('keeps 3150 Submitted Quotes with a separate Received Bids ledger using real APIs',()=>{
    const source=read('app/admin/exchange/page.tsx');
    expect(source).toContain('CompanyMarketplaceExchange initialTab="bids"');
    expect(source).toContain('ReceivedBidsPage');
    expect(source).toContain('Received Bids');
    expect(source).toContain('Submitted Quotes');
    expect(source).toContain("direction === 'received'");
    expect(source).toContain("allowedRoles={['owner', 'company_admin', 'company_staff']}");
    const bids=read('app/admin/bids/page.tsx');
    expect(bids).toContain('job_bids_with_job_owner');
    expect(bids).toContain('Received Bids');
  });
  it('keeps 9 existing Diary status tabs while separately displaying outsourced loads read-only',()=>{
    const source=read('app/components/workspace/OperationsDiaryPage.tsx');
    expect(source).toContain("data-diary-scope=\"externally-fulfilled\"");
    expect(source).toContain('externallyFulfilledJobs.map');
    expect(source).toContain('Read-only; not own-fleet bookings.');
    expect(source).toContain('setExternallyFulfilledJobs(loadedJobs.filter');
    expect(source).toContain('const scoped = loadedJobs.filter((job) => isOperatingCompanyJob(job, companyId))');
    expect(source).toContain('diaryTabs.map');
    const panel=source.slice(source.indexOf('data-diary-scope="externally-fulfilled"'),source.indexOf('className="workspace-record-meta workspace-list-controls cx-diary-toolbar"'));
    expect(panel).not.toContain('assignDriver(');
    expect(panel).not.toContain('cancelJob(');
    expect(panel).toContain("onClick={()=>setViewMode('list')}");
    expect(panel).toContain("onClick={()=>setViewMode('calendar')}");
    expect((panel.match(/onClick=/g) ?? [])).toHaveLength(2);
  });
});
