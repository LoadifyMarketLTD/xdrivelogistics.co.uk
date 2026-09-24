import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(process.cwd(), 'app/api/driver/jobs/[jobId]/feedback/route.ts'), 'utf8');

describe('CX Driver Diary feedback mutation parity', () => {
  it('offers leave/edit feedback only on terminal assigned bookings', () => {
    expect(diary).toContain("['delivered', 'completed', 'cancelled'].includes(currentStatus)");
    expect(diary).toContain("ownReview ? 'Edit feedback' : 'Leave feedback'");
    expect(diary).toContain('/feedback`');
  });

  it('keeps feedback mutation server-side and bound to the assigned driver and posting company', () => {
    expect(route).toContain('requireActiveWebDriver');
    expect(route).toContain("job.assigned_driver_id !== driver.driverId");
    expect(route).toContain("company_id: job.company_id");
    expect(route).toContain("reviewer_user_id: driver.userId");
    expect(route).toContain(".eq('reviewer_user_id', driver.userId)");
  });

  it('updates existing feedback instead of creating duplicate feedback from the same driver for the same job', () => {
    expect(route).toContain("supabaseAdmin.from('reviews').update(payload)");
    expect(route).toContain("supabaseAdmin.from('reviews').insert(payload)");
    expect(route).toContain('updated: Boolean(existing?.id)');
  });
});
