import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Driver booking storyboard visible reference safety', () => {
  it('never derives the visible booking reference from the internal UUID on rebuilt pages 1-5', () => {
    const source=fs.readFileSync(path.join(process.cwd(),'app/components/workspace/DriverJobExecutionPage.tsx'),'utf8');
    const start=source.indexOf("approvedScreen.number===1 && currentStatus==='accepted'");
    const end=source.indexOf('return <div className="fresh-mobile-booking"',start);
    const rebuilt=source.slice(start,end);
    expect(rebuilt).not.toContain('job.id.slice');
    expect((rebuilt.match(/bookingReference=\{sheet\?\.bookingReference\?\?null\}/g)||[]).length).toBe(5);
  });

  it('hides the booking reference label when no real reference is supplied', () => {
    const frame=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/WorkflowFrame.tsx'),'utf8');
    const page1=fs.readFileSync(path.join(process.cwd(),'app/driver-pwa-fresh/bookings/[id]/workflow/BookingDetailsStep.tsx'),'utf8');
    expect(frame).toContain('bookingReference?<small>BOOKING {bookingReference}</small>');
    expect(page1).toContain('{bookingReference&&<span');
  });
});
