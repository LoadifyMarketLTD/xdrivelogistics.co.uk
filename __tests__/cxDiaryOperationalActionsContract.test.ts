import fs from 'node:fs';
import path from 'node:path';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const freightVision = fs.readFileSync(path.join(process.cwd(), 'app/admin/freight-vision/page.tsx'), 'utf8');
const manageRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/jobs/[id]/manage/route.ts'), 'utf8');

describe('CX Diary P0 operational action parity', () => {
  it('connects Diary to existing finance, tracking, messaging and canonical job editing', () => {
    expect(diary).toContain("router.push('/admin/finance/reports')");
    expect(diary).toContain('/admin/freight-vision?jobId=');
    expect(diary).toContain('/admin/messages?jobId=');
    expect(diary).toContain('/admin/jobs/${encodeURIComponent(job.id)}');
    for (const label of ['Payment Report', 'Track', 'Message', 'Edit']) expect(diary).toContain(`>${label}<`);
  });

  it('keeps cancellation on the canonical company-authorised server workflow', () => {
    expect(diary).toContain("job.company_id !== companyId");
    expect(diary).toContain("action: 'cancel'");
    expect(diary).toContain('/api/admin/jobs/${encodeURIComponent(job.id)}/manage');
    expect(manageRoute).toContain("action: z.literal('cancel')");
    expect(manageRoute).toContain('Only the load-owning company can manage this job.');
    expect(manageRoute).toContain('request_awarded_job_cancellation_atomic');
    expect(manageRoute).toContain('cancel_unassigned_exchange_job_atomic');
  });

  it('lets Freight Vision focus a Diary-selected job without inventing tracking data', () => {
    expect(freightVision).toContain("const targetJobId = searchParams.get('jobId')");
    expect(freightVision).toContain('const target = rows.find((row) => row.job.id === targetJobId)');
    expect(freightVision).toContain('setSelectedJobId(targetJobId)');
    expect(freightVision).toContain('setSelectedDriverId(target.driver?.id ?? null)');
  });

  it('does not couple the workflow to Super Admin', () => {
    expect(diary).not.toContain('/super-admin');
    expect(freightVision).not.toContain('/super-admin');
  });
});
