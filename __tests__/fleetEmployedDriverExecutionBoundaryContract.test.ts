import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Fleet employed Driver execution boundary', () => {
  const notes = read('app/api/driver/jobs/[jobId]/notes/route.ts');
  const availability = read('app/api/driver/availability-slots/route.ts');

  it('allows operational job notes only on jobs assigned to the authenticated Driver', () => {
    expect(notes).toContain('requireActiveWebDriver(request)');
    expect(notes).toContain(".select('id, company_id, assigned_driver_id')");
    expect(notes).toContain(".eq('assigned_driver_id', driver.driverId)");
    expect(notes).toContain('author_user_id: driver.userId');
    expect(notes).not.toContain('resolveCompanyAccess');
  });

  it('keeps weekly availability self-service bound to an approved Driver workspace identity', () => {
    expect(availability).toContain('requireActiveWebDriver(request)');
    expect(availability).toContain(".eq('driver_id', driver.driverId)");
    expect(availability).toContain(".from('driver_availability_slots')");
    expect(availability).toContain('.upsert(');
  });
});
