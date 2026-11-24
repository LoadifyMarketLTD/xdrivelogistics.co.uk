import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const diary = readFileSync(resolve(process.cwd(), 'app/components/workspace/OperationsDiaryPage.tsx'), 'utf8');
const panel = readFileSync(resolve(process.cwd(), 'app/components/workspace/CompanyJobSheetPanel.tsx'), 'utf8');
const transition = readFileSync(resolve(process.cwd(), 'app/api/admin/jobs/[id]/transition/route.ts'), 'utf8');

describe('Company Admin Diary operational status access', () => {
  it('opens existing progress control for an assigned active job without performing a transition on click', () => {
    expect(diary).toContain("companyAdmin && canManageCompanyBookings && job.assigned_driver_id && stage === 'in_progress'");
    expect(diary).toContain("onClick={() => openJobTab(job.id, 'progress')}>Update Status</ActionButton>");
    expect(diary).not.toContain("onClick={() => advanceOperatorStatus(job");
  });

  it('keeps status updates restricted to sequential backend-authorized transitions', () => {
    expect(panel).toContain('OPERATOR_NEXT_STATUS');
    expect(panel).toContain('canManageOperationalStatus');
    expect(panel).toContain('operatorTransitionBlocked');
    expect(panel).toContain('expectedStatus: sheet.status');
    expect(transition).toContain("requireCompanyCapability(request, operatingCompanyId, 'jobs.dispatch')");
  });
});
